import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { all, get, run } from '../db.js'
import type { Sample, Reminder, TestResult } from '../../shared/types.js'

const router = Router()

function determineCategory(sample: Sample, testResults: TestResult[]): '待批文' | '待复检' | '待库位清点' {
  if (sample.isInvolved && (!sample.disposalDocNo || sample.disposalDocNo.trim() === '')) {
    return '待批文'
  }
  if (testResults.length > 0) {
    const latest = testResults[testResults.length - 1]
    if (latest.conclusion === '需复检' && (!latest.recheckConclusion || latest.recheckConclusion === '待补录')) {
      return '待复检'
    }
  }
  return '待库位清点'
}

function determineResponsiblePerson(sample: Sample, category: '待批文' | '待复检' | '待库位清点'): string {
  if (category === '待批文') {
    return sample.createdBy || '收样员'
  }
  if (category === '待复检') {
    return '检测工程师'
  }
  return '库管员'
}

router.get('/reminders', async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { category, status } = req.query

    const overdueSamples = all<Sample>(
      "SELECT * FROM samples WHERE retention_end < ? AND status NOT IN ('已处置') ORDER BY retention_end ASC",
      [today]
    )

    for (const sample of overdueSamples) {
      const testResults = all<TestResult>(
        'SELECT * FROM test_results WHERE sample_id = ? ORDER BY created_at DESC',
        [sample.id]
      )
      const category = determineCategory(sample, testResults)
      const responsiblePerson = determineResponsiblePerson(sample, category)
      const overdueDays = Math.floor(
        (new Date(today).getTime() - new Date(sample.retentionEnd).getTime()) / (1000 * 60 * 60 * 24)
      )

      const existing = get<Reminder>(
        'SELECT * FROM reminders WHERE sample_id = ? AND status IN (?, ?, ?)',
        [sample.id, '待催办', '已催办', '处理中']
      )

      if (existing) {
        run(
          'UPDATE reminders SET overdue_days = ?, category = ?, responsible_person = ? WHERE id = ?',
          [overdueDays, category, responsiblePerson, existing.id]
        )
      } else {
        const id = uuidv4()
        run(
          `INSERT INTO reminders (id, sample_id, overdue_days, category, status, responsible_person) VALUES (?, ?, ?, ?, '待催办', ?)`,
          [id, sample.id, overdueDays, category, responsiblePerson]
        )
      }

      if (sample.status !== '超期' && sample.status !== '已冻结') {
        run("UPDATE samples SET status = '超期' WHERE id = ?", [sample.id])
        run(
          `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '超期标记', ?, ?, ?)`,
          [
            uuidv4(), sample.id, 'system', '系统',
            `样品留置截止日为 ${sample.retentionEnd}，已超期 ${overdueDays} 天，催办分类: ${category}，责任人: ${responsiblePerson}`,
          ]
        )
      }
    }

    let sql = "SELECT * FROM reminders WHERE status != '已完结'"
    const params: unknown[] = []
    if (category) {
      sql += ' AND category = ?'
      params.push(category)
    }
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY overdue_days DESC, created_at ASC'

    const reminders = all<Reminder>(sql, params)

    const result = reminders.map((r) => {
      const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [r.sampleId])
      const testResults = sample
        ? all<TestResult>('SELECT * FROM test_results WHERE sample_id = ? ORDER BY created_at DESC', [sample.id])
        : []
      const latestTest = testResults.length > 0 ? testResults[0] : null
      return {
        ...r,
        sample,
        latestTest,
      }
    })

    const stats = {
      total: result.length,
      待批文: result.filter((r) => r.category === '待批文').length,
      待复检: result.filter((r) => r.category === '待复检').length,
      待库位清点: result.filter((r) => r.category === '待库位清点').length,
    }

    res.json({ success: true, data: result, stats })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.get('/reminders/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().slice(0, 10)

    const overdueSamples = all<Sample>(
      "SELECT * FROM samples WHERE retention_end < ? AND status NOT IN ('已处置')",
      [today]
    )

    const stats = {
      total: 0,
      待批文: 0,
      待复检: 0,
      待库位清点: 0,
      待催办: 0,
      已催办: 0,
      处理中: 0,
    }

    for (const sample of overdueSamples) {
      const testResults = all<TestResult>(
        'SELECT * FROM test_results WHERE sample_id = ? ORDER BY created_at DESC',
        [sample.id]
      )
      const category = determineCategory(sample, testResults)
      stats.total++
      stats[category]++

      const reminder = get<Reminder>(
        "SELECT * FROM reminders WHERE sample_id = ? AND status != '已完结' ORDER BY created_at DESC LIMIT 1",
        [sample.id]
      )
      if (reminder && reminder.status in stats) {
        stats[reminder.status as keyof typeof stats]++
      }
    }

    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.put('/reminders/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const reminder = get<Reminder>('SELECT * FROM reminders WHERE id = ?', [req.params.id])
    if (!reminder) {
      res.status(404).json({ success: false, error: '催办记录不存在' })
      return
    }

    const { status, remindBy, comment } = req.body

    if (status === '已催办' && !reminder.remindAt) {
      run(
        `UPDATE reminders SET status = ?, remind_at = ?, remind_by = ? WHERE id = ?`,
        [status, new Date().toISOString(), remindBy || '', req.params.id]
      )
      run(
        `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '催办标记', ?, ?, ?)`,
        [
          uuidv4(), reminder.sampleId, remindBy || 'system', '管理员',
          `催办状态标记为已催办${comment ? '，备注: ' + comment : ''}，责任人: ${reminder.responsiblePerson}`,
        ]
      )
    } else if (status === '处理中') {
      run('UPDATE reminders SET status = ?, remind_by = COALESCE(?, remind_by) WHERE id = ?', [
        status,
        remindBy || null,
        req.params.id,
      ])
      run(
        `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '催办处理中', ?, ?, ?)`,
        [
          uuidv4(), reminder.sampleId, remindBy || 'system', '操作员',
          `催办进入处理中状态${comment ? '，备注: ' + comment : ''}，责任人: ${reminder.responsiblePerson}`,
        ]
      )
    } else if (status === '已完结') {
      run('UPDATE reminders SET status = ? WHERE id = ?', [status, req.params.id])
      run(
        `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '催办完结', ?, ?, ?)`,
        [
          uuidv4(), reminder.sampleId, remindBy || 'system', '管理员',
          `催办事项已完结${comment ? '，备注: ' + comment : ''}，责任人: ${reminder.responsiblePerson}`,
        ]
      )
    } else {
      run('UPDATE reminders SET status = ? WHERE id = ?', [status, req.params.id])
    }

    const updated = get<Reminder>('SELECT * FROM reminders WHERE id = ?', [req.params.id])
    const sample = updated ? get<Sample>('SELECT * FROM samples WHERE id = ?', [updated.sampleId]) : null
    res.json({ success: true, data: { ...updated, sample } })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.post('/reminders/:id/reassign', async (req: Request, res: Response): Promise<void> => {
  try {
    const reminder = get<Reminder>('SELECT * FROM reminders WHERE id = ?', [req.params.id])
    if (!reminder) {
      res.status(404).json({ success: false, error: '催办记录不存在' })
      return
    }

    const { responsiblePerson, reassignedBy, reason } = req.body
    if (!responsiblePerson || responsiblePerson.trim() === '') {
      res.status(400).json({ success: false, error: '新责任人不能为空' })
      return
    }

    const oldResponsible = reminder.responsiblePerson
    run(
      'UPDATE reminders SET responsible_person = ? WHERE id = ?',
      [responsiblePerson.trim(), req.params.id]
    )

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '责任人变更', ?, ?, ?)`,
      [
        uuidv4(), reminder.sampleId, reassignedBy || 'system', '管理员',
        `催办责任人由「${oldResponsible || '未指定'}」变更为「${responsiblePerson}」${reason ? '，原因: ' + reason : ''}`,
      ]
    )

    const updated = get<Reminder>('SELECT * FROM reminders WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
