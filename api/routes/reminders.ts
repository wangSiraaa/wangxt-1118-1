import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { all, get, run } from '../db.js'
import type { Sample, Reminder } from '../../shared/types.js'

const router = Router()

router.get('/reminders', async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().slice(0, 10)

    const overdueSamples = all<Sample>(
      "SELECT * FROM samples WHERE retention_end < ? AND status NOT IN ('已处置')",
      [today]
    )

    for (const sample of overdueSamples) {
      const existing = get<Reminder>(
        'SELECT * FROM reminders WHERE sample_id = ? AND status IN (?, ?)',
        [sample.id, '待催办', '已催办']
      )

      const overdueDays = Math.floor(
        (new Date(today).getTime() - new Date(sample.retentionEnd).getTime()) / (1000 * 60 * 60 * 24)
      )

      if (existing) {
        run('UPDATE reminders SET overdue_days = ? WHERE id = ?', [overdueDays, existing.id])
      } else {
        const id = uuidv4()
        run(
          `INSERT INTO reminders (id, sample_id, overdue_days, status) VALUES (?, ?, ?, '待催办')`,
          [id, sample.id, overdueDays]
        )
      }

      if (sample.status !== '超期') {
        run("UPDATE samples SET status = '超期' WHERE id = ?", [sample.id])
      }
    }

    const reminders = all<Reminder>(
      "SELECT * FROM reminders WHERE status != '已完结' ORDER BY overdue_days DESC"
    )

    const result = reminders.map((r) => {
      const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [r.sampleId])
      return { ...r, sample }
    })

    res.json({ success: true, data: result })
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

    const { status, remindBy } = req.body

    if (status === '已催办' && !reminder.remindAt) {
      run(
        `UPDATE reminders SET status = ?, remind_at = ?, remind_by = ? WHERE id = ?`,
        [status, new Date().toISOString(), remindBy || '', req.params.id]
      )
    } else {
      run('UPDATE reminders SET status = ? WHERE id = ?', [status, req.params.id])
    }

    const updated = get<Reminder>('SELECT * FROM reminders WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
