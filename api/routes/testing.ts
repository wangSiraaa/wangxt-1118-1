import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { all, get, run } from '../db.js'
import type { Sample, TestResult } from '../../shared/types.js'

const router = Router()

router.get('/samples/pending-test', async (req: Request, res: Response): Promise<void> => {
  try {
    const samples = all<Sample>(
      "SELECT * FROM samples WHERE status IN ('在库', '待检测') ORDER BY created_at DESC"
    )
    res.json({ success: true, data: samples })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.post('/samples/:id/testing', async (req: Request, res: Response): Promise<void> => {
  try {
    const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [req.params.id])
    if (!sample) {
      res.status(404).json({ success: false, error: '样品不存在' })
      return
    }

    if (!['在库', '待检测', '检测中'].includes(sample.status)) {
      res.status(400).json({ success: false, error: `样品当前状态为"${sample.status}"，无法提交检测结果` })
      return
    }

    const { conclusion, tester, reportFile } = req.body
    if (!conclusion || !tester) {
      res.status(400).json({ success: false, error: '检测结论和检测人不能为空' })
      return
    }

    const testId = uuidv4()
    const now = new Date().toISOString()

    run(
      `INSERT INTO test_results (id, sample_id, conclusion, test_date, tester, report_file) VALUES (?, ?, ?, ?, ?, ?)`,
      [testId, req.params.id, conclusion, now.slice(0, 10), tester, reportFile || '']
    )

    run(`UPDATE samples SET status = '已检测' WHERE id = ?`, [req.params.id])

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '提交检测', ?, ?, ?)`,
      [
        uuidv4(), req.params.id, tester, '检测员',
        `检测结论: ${conclusion}`,
      ]
    )

    const testResult = get<TestResult>('SELECT * FROM test_results WHERE id = ?', [testId])
    res.status(201).json({ success: true, data: testResult })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
