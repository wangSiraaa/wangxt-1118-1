import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { addDays } from 'date-fns'
import { all, get, run } from '../db.js'
import type { Sample, Disposal, TestResult, Extension, FreezeRecord, SplitSample } from '../../shared/types.js'

const router = Router()

router.get('/disposals', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, sampleId, type } = req.query
    let sql = 'SELECT * FROM disposals WHERE 1=1'
    const params: unknown[] = []
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    if (sampleId) {
      sql += ' AND sample_id = ?'
      params.push(sampleId)
    }
    if (type) {
      sql += ' AND type = ?'
      params.push(type)
    }
    sql += ' ORDER BY created_at DESC'
    const disposals = all<Disposal>(sql, params)

    const result = disposals.map((d) => {
      const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [d.sampleId])
      return { ...d, sample }
    })

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.post('/disposals/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sampleId, type } = req.body
    if (!sampleId) {
      res.status(400).json({ success: false, error: '样品ID不能为空' })
      return
    }

    const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [sampleId])
    if (!sample) {
      res.status(404).json({ success: false, error: '样品不存在' })
      return
    }

    const validation = {
      retentionPassed: false,
      docPassed: false,
      reviewPassed: false,
      retentionMessage: '',
      docMessage: '',
      reviewMessage: '',
      canProceed: false,
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const retentionEndDate = new Date(sample.retentionEnd)
    retentionEndDate.setHours(0, 0, 0, 0)
    const daysRemaining = Math.ceil((retentionEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (type === '退样' || type === '销毁') {
      if (daysRemaining <= 0) {
        validation.retentionPassed = true
        validation.retentionMessage = `留置期已届满（${sample.retentionEnd}），符合处置条件`
      } else {
        validation.retentionMessage = `留置期未满，截止日为 ${sample.retentionEnd}，剩余 ${daysRemaining} 天`
      }
    } else {
      validation.retentionPassed = true
      validation.retentionMessage = '该处置类型无需留置期校验'
    }

    if (sample.isInvolved) {
      if (sample.disposalDocNo && sample.disposalDocNo.trim() !== '') {
        validation.docPassed = true
        validation.docMessage = `已取得处置批文：${sample.disposalDocNo}`
      } else {
        validation.docMessage = '涉案样品未取得处置批文，需先获取批文'
      }
    } else {
      validation.docPassed = true
      validation.docMessage = '非涉案样品，无需批文校验'
    }

    const testResults = all<TestResult>('SELECT * FROM test_results WHERE sample_id = ? ORDER BY created_at DESC', [sampleId])
    if (testResults.length === 0) {
      validation.reviewPassed = true
      validation.reviewMessage = '无检测记录，无需复核闭环校验'
    } else {
      const latestTest = testResults[0]
      if (latestTest.conclusion === '需复检') {
        if (latestTest.recheckConclusion && latestTest.recheckConclusion !== '待补录') {
          if (sample.reviewClosed) {
            validation.reviewPassed = true
            validation.reviewMessage = `复检结论已补录（${latestTest.recheckConclusion}），复核已闭环`
          } else {
            validation.reviewMessage = `复检结论已补录（${latestTest.recheckConclusion}），但复核流程尚未闭环`
          }
        } else {
          validation.reviewMessage = `检测结论为"需复检"，但复检结论尚未补录`
        }
      } else {
        if (sample.reviewClosed) {
          validation.reviewPassed = true
          validation.reviewMessage = `检测结论已确认（${latestTest.conclusion}），复核已闭环`
        } else {
          validation.reviewPassed = true
          validation.reviewMessage = `检测结论为"${latestTest.conclusion}"，无需复检`
        }
      }
    }

    if (sample.freezeStatus === '已冻结') {
      validation.canProceed = false
      res.json({
        success: true,
        data: {
          ...validation,
          canProceed: false,
          freezeBlocked: true,
          message: '样品当前处于冻结状态，需先解冻才能发起处置',
        },
      })
      return
    }

    validation.canProceed = validation.retentionPassed && validation.docPassed && validation.reviewPassed

    res.json({
      success: true,
      data: {
        ...validation,
        sampleStatus: sample.status,
        freezeStatus: sample.freezeStatus,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.post('/disposals', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      sampleId, type, reason, destination, destroyMethod,
      witness, disposalDocNo, createdBy,
      extendedDays, newRetentionEnd,
      splitQuantity, splitToSampleCode,
      freezeType, freezeOrderNo, freezeEndDate,
    } = req.body

    if (!sampleId || !type) {
      res.status(400).json({ success: false, error: '样品ID和处置类型不能为空' })
      return
    }

    const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [sampleId])
    if (!sample) {
      res.status(404).json({ success: false, error: '样品不存在' })
      return
    }

    const id = uuidv4()
    const now = new Date().toISOString()

    if (type === '延期') {
      if (!extendedDays || extendedDays <= 0) {
        res.status(400).json({ success: false, error: '延期天数必须大于0' })
        return
      }
      if (!newRetentionEnd) {
        res.status(400).json({ success: false, error: '新留置截止日不能为空' })
        return
      }

      run(
        `INSERT INTO disposals (id, sample_id, type, reason, disposal_doc_no, extended_days, new_retention_end, status, created_by, validation_retention_passed, validation_doc_passed, validation_review_passed)
         VALUES (?, ?, '延期', ?, ?, ?, ?, '待审批', ?, 1, 1, 1)`,
        [
          id, sampleId, reason || '', disposalDocNo || '',
          extendedDays, newRetentionEnd, createdBy || 'system',
        ]
      )

      run(
        `INSERT INTO extensions (id, sample_id, original_end_date, extended_days, new_end_date, reason, approval_doc, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, '待审批', ?)`,
        [
          uuidv4(), sampleId, sample.retentionEnd, extendedDays,
          newRetentionEnd, reason || '', disposalDocNo || '', createdBy || 'system',
        ]
      )

      run(
        `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '申请延期', ?, ?, ?)`,
        [
          uuidv4(), sampleId, createdBy || 'system', '库管员',
          `申请延期 ${extendedDays} 天，原截止日 ${sample.retentionEnd}，新截止日 ${newRetentionEnd}，原因: ${reason || '无'}`,
        ]
      )
    } else if (type === '冻结') {
      if (!freezeType || !freezeOrderNo || !freezeEndDate) {
        res.status(400).json({ success: false, error: '冻结类型、冻结文书号和冻结截止日均不能为空' })
        return
      }

      run(
        `INSERT INTO disposals (id, sample_id, type, reason, freeze_type, freeze_order_no, freeze_end_date, status, created_by, validation_retention_passed, validation_doc_passed, validation_review_passed)
         VALUES (?, ?, '冻结', ?, ?, ?, ?, '待审批', ?, 1, 1, 1)`,
        [
          id, sampleId, reason || '', freezeType, freezeOrderNo,
          freezeEndDate, createdBy || 'system',
        ]
      )

      run(
        `INSERT INTO freeze_records (id, sample_id, freeze_type, freeze_order_no, freeze_reason, freeze_start_date, freeze_end_date, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, '已冻结', ?)`,
        [
          uuidv4(), sampleId, freezeType, freezeOrderNo, reason || '',
          now.slice(0, 10), freezeEndDate, createdBy || 'system',
        ]
      )

      run("UPDATE samples SET freeze_status = '已冻结', status = '已冻结' WHERE id = ?", [sampleId])

      run(
        `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '涉案冻结', ?, ?, ?)`,
        [
          uuidv4(), sampleId, createdBy || 'system', '库管员',
          `执行${freezeType}，文书号: ${freezeOrderNo}，冻结至: ${freezeEndDate}，原因: ${reason || '无'}`,
        ]
      )
    } else if (type === '解冻') {
      if (sample.freezeStatus !== '已冻结') {
        res.status(400).json({ success: false, error: '样品当前未处于冻结状态' })
        return
      }

      run(
        `INSERT INTO disposals (id, sample_id, type, reason, disposal_doc_no, status, created_by, validation_retention_passed, validation_doc_passed, validation_review_passed)
         VALUES (?, ?, '解冻', ?, ?, '待审批', ?, 1, 1, 1)`,
        [id, sampleId, reason || '', disposalDocNo || '', createdBy || 'system']
      )

      run(
        `UPDATE freeze_records SET status = '已解冻', unfreeze_reason = ?, unfreeze_date = ?, approved_by = ? WHERE sample_id = ? AND status = '已冻结'`,
        [reason || '', now.slice(0, 10), createdBy || 'system', sampleId]
      )

      run("UPDATE samples SET freeze_status = '已解冻', status = '在库' WHERE id = ?", [sampleId])

      run(
        `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '解除冻结', ?, ?, ?)`,
        [
          uuidv4(), sampleId, createdBy || 'system', '库管员',
          `解除冻结，原因: ${reason || '无'}，批文: ${disposalDocNo || '无'}`,
        ]
      )
    } else if (type === '退样' || type === '销毁') {
      if (!['已检测', '待处置', '超期'].includes(sample.status)) {
        res.status(400).json({ success: false, error: `样品当前状态为"${sample.status}"，无法发起处置` })
        return
      }

      if (sample.freezeStatus === '已冻结') {
        res.status(400).json({ success: false, error: '样品处于冻结状态，需先解冻才能处置' })
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const retentionEndDate = new Date(sample.retentionEnd)
      retentionEndDate.setHours(0, 0, 0, 0)
      const daysRemaining = Math.ceil((retentionEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      const retentionPassed = daysRemaining <= 0
      const docPassed = !sample.isInvolved || (disposalDocNo && disposalDocNo.trim() !== '')

      const testResults = all<TestResult>('SELECT * FROM test_results WHERE sample_id = ? ORDER BY created_at DESC', [sampleId])
      let reviewPassed = true
      if (testResults.length > 0) {
        const latestTest = testResults[0]
        if (latestTest.conclusion === '需复检' && (!latestTest.recheckConclusion || latestTest.recheckConclusion === '待补录')) {
          reviewPassed = false
        }
      }

      if (!retentionPassed) {
        res.status(400).json({ success: false, error: `样品留置期未满，留置截止日为 ${sample.retentionEnd}，剩余 ${daysRemaining} 天，到期后方可发起处置` })
        return
      }

      if (!docPassed) {
        res.status(400).json({ success: false, error: '涉案样品必须填写处置文书号' })
        return
      }

      if (!reviewPassed) {
        res.status(400).json({ success: false, error: '检测结论为"需复检"，但复检结论尚未补录，复核未闭环' })
        return
      }

      run(
        `INSERT INTO disposals (id, sample_id, type, reason, destination, destroy_method, witness, disposal_doc_no, status, created_by, validation_retention_passed, validation_doc_passed, validation_review_passed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '待审批', ?, ?, ?, ?)`,
        [
          id, sampleId, type, reason || '', destination || '',
          destroyMethod || '', witness || '', disposalDocNo || '',
          createdBy || 'system',
          retentionPassed ? 1 : 0,
          docPassed ? 1 : 0,
          reviewPassed ? 1 : 0,
        ]
      )

      run("UPDATE samples SET status = '待处置' WHERE id = ?", [sampleId])

      run(
        `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '发起处置', ?, ?, ?)`,
        [
          uuidv4(), sampleId, createdBy || 'system', '库管员',
          `处置类型: ${type}，原因: ${reason || '无'}，留置期校验: ${retentionPassed ? '通过' : '未通过'}，批文校验: ${docPassed ? '通过' : '未通过'}，复核校验: ${reviewPassed ? '通过' : '未通过'}`,
        ]
      )
    } else {
      res.status(400).json({ success: false, error: `不支持的处置类型: ${type}` })
      return
    }

    const disposal = get<Disposal>('SELECT * FROM disposals WHERE id = ?', [id])
    res.status(201).json({ success: true, data: disposal })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.put('/disposals/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const disposal = get<Disposal>('SELECT * FROM disposals WHERE id = ?', [req.params.id])
    if (!disposal) {
      res.status(404).json({ success: false, error: '处置记录不存在' })
      return
    }

    if (disposal.status !== '待审批') {
      res.status(400).json({ success: false, error: `处置记录当前状态为"${disposal.status}"，无法审批` })
      return
    }

    const { approvedBy, approvalComment } = req.body
    const now = new Date().toISOString()

    run(
      `UPDATE disposals SET status = '已审批', approved_by = ?, approved_at = ?, approval_comment = ? WHERE id = ?`,
      [approvedBy || '', now, approvalComment || '', req.params.id]
    )

    if (disposal.type === '延期') {
      const ext = get<Extension>(
        "SELECT * FROM extensions WHERE sample_id = ? AND status = '待审批' ORDER BY created_at DESC LIMIT 1",
        [disposal.sampleId]
      )
      if (ext) {
        run(
          `UPDATE extensions SET status = '已审批', approved_by = ?, approved_at = ? WHERE id = ?`,
          [approvedBy || '', now, ext.id]
        )
      }
      if (disposal.newRetentionEnd) {
        run('UPDATE samples SET retention_end = ?, retention_days = retention_days + ? WHERE id = ?', [
          disposal.newRetentionEnd,
          disposal.extendedDays || 0,
          disposal.sampleId,
        ])
        const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [disposal.sampleId])
        if (sample) {
          const updatedSample = sample
          if (new Date(updatedSample.retentionEnd) >= new Date()) {
            if (updatedSample.status === '超期') {
              run("UPDATE samples SET status = '在库' WHERE id = ?", [disposal.sampleId])
            }
          }
        }
      }
      run(
        `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '延期审批通过', ?, ?, ?)`,
        [
          uuidv4(), disposal.sampleId, approvedBy || 'system', '审批人',
          `延期审批通过，新留置截止日: ${disposal.newRetentionEnd || '未知'}${approvalComment ? '，审批意见: ' + approvalComment : ''}`,
        ]
      )
    } else if (disposal.type === '冻结') {
      run("UPDATE samples SET freeze_status = '已冻结', status = '已冻结' WHERE id = ?", [disposal.sampleId])
      run(
        `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '冻结审批通过', ?, ?, ?)`,
        [
          uuidv4(), disposal.sampleId, approvedBy || 'system', '审批人',
          `冻结生效${approvalComment ? '，审批意见: ' + approvalComment : ''}`,
        ]
      )
    } else if (disposal.type === '解冻') {
      run("UPDATE samples SET freeze_status = '已解冻', status = '在库' WHERE id = ?", [disposal.sampleId])
      run(
        `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '解冻审批通过', ?, ?, ?)`,
        [
          uuidv4(), disposal.sampleId, approvedBy || 'system', '审批人',
          `解冻生效${approvalComment ? '，审批意见: ' + approvalComment : ''}`,
        ]
      )
    } else if (disposal.type === '退样' || disposal.type === '销毁') {
      run("UPDATE samples SET status = '处置中' WHERE id = ?", [disposal.sampleId])
      run(
        `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '处置审批通过', ?, ?, ?)`,
        [
          uuidv4(), disposal.sampleId, approvedBy || 'system', '审批人',
          `处置审批通过${approvalComment ? '，意见: ' + approvalComment : ''}`,
        ]
      )
    }

    const updatedDisposal = get<Disposal>('SELECT * FROM disposals WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updatedDisposal })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.put('/disposals/:id/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const disposal = get<Disposal>('SELECT * FROM disposals WHERE id = ?', [req.params.id])
    if (!disposal) {
      res.status(404).json({ success: false, error: '处置记录不存在' })
      return
    }

    if (disposal.status !== '已审批') {
      res.status(400).json({ success: false, error: `处置记录当前状态为"${disposal.status}"，需先通过审批才能执行` })
      return
    }

    const { executedBy } = req.body
    const now = new Date().toISOString()

    run("UPDATE disposals SET status = '已执行' WHERE id = ?", [req.params.id])

    if (disposal.type === '退样' || disposal.type === '销毁') {
      run("UPDATE samples SET status = '已处置' WHERE id = ?", [disposal.sampleId])
      const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [disposal.sampleId])
      if (sample && sample.warehouseId) {
        run("UPDATE warehouses SET status = '待清理', current_sample_id = '' WHERE id = ?", [sample.warehouseId])
      }
    }

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '处置执行', ?, ?, ?)`,
      [
        uuidv4(), disposal.sampleId, executedBy || 'system', '库管员',
        `${disposal.type}执行完成`,
      ]
    )

    const updatedDisposal = get<Disposal>('SELECT * FROM disposals WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updatedDisposal })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.get('/extensions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sampleId, status } = req.query
    let sql = 'SELECT * FROM extensions WHERE 1=1'
    const params: unknown[] = []
    if (sampleId) {
      sql += ' AND sample_id = ?'
      params.push(sampleId)
    }
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY created_at DESC'
    const extensions = all<Extension>(sql, params)
    const result = extensions.map((e) => {
      const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [e.sampleId])
      return { ...e, sample }
    })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.get('/freeze-records', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sampleId, status } = req.query
    let sql = 'SELECT * FROM freeze_records WHERE 1=1'
    const params: unknown[] = []
    if (sampleId) {
      sql += ' AND sample_id = ?'
      params.push(sampleId)
    }
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY created_at DESC'
    const records = all<FreezeRecord>(sql, params)
    const result = records.map((r) => {
      const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [r.sampleId])
      return { ...r, sample }
    })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.get('/split-samples', async (req: Request, res: Response): Promise<void> => {
  try {
    const { parentSampleId, status } = req.query
    let sql = 'SELECT * FROM split_samples WHERE 1=1'
    const params: unknown[] = []
    if (parentSampleId) {
      sql += ' AND parent_sample_id = ?'
      params.push(parentSampleId)
    }
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY created_at DESC'
    const splits = all<SplitSample>(sql, params)
    const result = splits.map((s) => {
      const parent = get<Sample>('SELECT * FROM samples WHERE id = ?', [s.parentSampleId])
      const child = get<Sample>('SELECT * FROM samples WHERE id = ?', [s.childSampleId])
      return { ...s, parentSample: parent, childSample: child }
    })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
