import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { all, get, run } from '../db.js'
import type { Sample, TestResult, RecheckConclusion } from '../../shared/types.js'

const router = Router()

router.get('/samples/pending-test', async (req: Request, res: Response): Promise<void> => {
  try {
    const samples = all<Sample>(
      "SELECT * FROM samples WHERE status IN ('在库', '待检测', '已冻结') ORDER BY created_at DESC"
    )
    res.json({ success: true, data: samples })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.get('/samples/pending-recheck', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = all<{ id: string; sample_id: string; conclusion: string; recheck_conclusion: string }>(
      `SELECT tr.* FROM test_results tr 
       INNER JOIN samples s ON tr.sample_id = s.id 
       WHERE tr.conclusion = '需复检' 
       AND (tr.recheck_conclusion IS NULL OR tr.recheck_conclusion = '' OR tr.recheck_conclusion = '待补录')
       AND s.status NOT IN ('已处置')
       ORDER BY tr.created_at DESC`
    )
    const sampleIds = [...new Set(rows.map(r => r.sample_id))]
    const samples: Sample[] = []
    for (const sid of sampleIds) {
      const s = get<Sample>('SELECT * FROM samples WHERE id = ?', [sid])
      if (s) samples.push(s)
    }
    res.json({ success: true, data: { samples, testResults: rows } })
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

    const { conclusion, tester, reportFile, testDate } = req.body
    if (!conclusion || !tester) {
      res.status(400).json({ success: false, error: '检测结论和检测人不能为空' })
      return
    }

    const testId = uuidv4()
    const now = new Date().toISOString()
    const useDate = testDate || now.slice(0, 10)

    const validRecheckConclusions: RecheckConclusion[] = ['无需复检', '复检合格', '复检不合格', '待补录']
    const defaultRecheck: RecheckConclusion = conclusion === '需复检' ? '待补录' : '无需复检'

    run(
      `INSERT INTO test_results (id, sample_id, conclusion, recheck_conclusion, test_date, tester, report_file) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [testId, req.params.id, conclusion, defaultRecheck, useDate, tester, reportFile || '']
    )

    const reviewClosed = conclusion !== '需复检' ? 1 : 0
    run(`UPDATE samples SET status = '已检测', review_closed = ? WHERE id = ?`, [reviewClosed, req.params.id])

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '提交检测', ?, ?, ?)`,
      [
        uuidv4(), req.params.id, tester, '检测工程师',
        `检测结论: ${conclusion}${conclusion === '需复检' ? '，待补录复检结论' : ''}，复核闭环: ${reviewClosed ? '是' : '否'}`,
      ]
    )

    const testResult = get<TestResult>('SELECT * FROM test_results WHERE id = ?', [testId])
    res.status(201).json({ success: true, data: testResult })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.put('/samples/:id/recheck', async (req: Request, res: Response): Promise<void> => {
  try {
    const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [req.params.id])
    if (!sample) {
      res.status(404).json({ success: false, error: '样品不存在' })
      return
    }

    const { testResultId, recheckConclusion, recheckDate, recheckTester, recheckReportFile } = req.body
    if (!testResultId || !recheckConclusion) {
      res.status(400).json({ success: false, error: '检测记录ID和复检结论不能为空' })
      return
    }

    const validRecheck: RecheckConclusion[] = ['复检合格', '复检不合格', '无需复检']
    if (!validRecheck.includes(recheckConclusion as RecheckConclusion)) {
      res.status(400).json({ success: false, error: '复检结论值无效' })
      return
    }

    const testResult = get<TestResult>('SELECT * FROM test_results WHERE id = ? AND sample_id = ?', [testResultId, req.params.id])
    if (!testResult) {
      res.status(404).json({ success: false, error: '检测记录不存在或不属于该样品' })
      return
    }

    if (testResult.conclusion !== '需复检') {
      res.status(400).json({ success: false, error: '该检测结论不是"需复检"，无需补录复检结论' })
      return
    }

    const now = new Date().toISOString()
    const useDate = recheckDate || now.slice(0, 10)

    run(
      `UPDATE test_results SET recheck_conclusion = ?, recheck_date = ?, recheck_tester = ?, recheck_report_file = ? WHERE id = ?`,
      [recheckConclusion, useDate, recheckTester || '', recheckReportFile || '', testResultId]
    )

    run(`UPDATE samples SET review_closed = 1 WHERE id = ?`, [req.params.id])

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '补录复检', ?, ?, ?)`,
      [
        uuidv4(), req.params.id, recheckTester || '系统', '检测工程师',
        `复检结论: ${recheckConclusion}，复核闭环: 是，检测记录: ${testResultId}`,
      ]
    )

    const updated = get<TestResult>('SELECT * FROM test_results WHERE id = ?', [testResultId])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.get('/samples/:id/test-results', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = all<TestResult>(
      'SELECT * FROM test_results WHERE sample_id = ? ORDER BY created_at DESC',
      [req.params.id]
    )
    res.json({ success: true, data: rows })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
