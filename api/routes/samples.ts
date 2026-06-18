import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { format } from 'date-fns'
import { all, get, run } from '../db.js'
import type { Sample, TestResult, Disposal } from '../../shared/types.js'

const router = Router()

router.get('/samples', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query
    let sql = 'SELECT * FROM samples WHERE 1=1'
    const params: unknown[] = []
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY created_at DESC'
    const samples = all<Sample>(sql, params)
    res.json({ success: true, data: samples })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.get('/samples/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [req.params.id])
    if (!sample) {
      res.status(404).json({ success: false, error: '样品不存在' })
      return
    }
    const testResults = all<TestResult>('SELECT * FROM test_results WHERE sample_id = ?', [req.params.id])
    const disposals = all<Disposal>('SELECT * FROM disposals WHERE sample_id = ?', [req.params.id])
    res.json({ success: true, data: { ...sample, testResults, disposals } })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.post('/samples', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      source, caseNo, sealNo, itemName, quantity, spec,
      retentionDays, retentionStart, retentionEnd, isInvolved,
      disposalDocNo, createdBy,
    } = req.body

    if (!sealNo || sealNo.trim() === '') {
      res.status(400).json({ success: false, error: '封条号不能为空' })
      return
    }

    const id = uuidv4()
    const today = format(new Date(), 'yyyyMMdd')
    const prefix = `YP-${today}-`

    const lastSample = get<{ sampleCode: string }>(
      "SELECT sample_code as sampleCode FROM samples WHERE sample_code LIKE ? ORDER BY sample_code DESC LIMIT 1",
      [`${prefix}%`]
    )

    let seq = 1
    if (lastSample?.sampleCode) {
      const lastSeq = parseInt(lastSample.sampleCode.substring(prefix.length), 10)
      if (!isNaN(lastSeq)) seq = lastSeq + 1
    }

    const sampleCode = `${prefix}${seq.toString().padStart(4, '0')}`

    run(
      `INSERT INTO samples (id, sample_code, source, case_no, seal_no, item_name, quantity, spec, retention_days, retention_start, retention_end, is_involved, disposal_doc_no, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待入库', ?)`,
      [
        id, sampleCode, source, caseNo, sealNo, itemName,
        quantity || 1, spec || '', retentionDays || 90,
        retentionStart, retentionEnd, isInvolved ? 1 : 0,
        disposalDocNo || '', createdBy || 'system',
      ]
    )

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '收样登记', ?, ?, ?)`,
      [uuidv4(), id, createdBy || 'system', '操作员', `样品 ${sampleCode} 登记入库`]
    )

    const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [id])
    res.status(201).json({ success: true, data: sample })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.put('/samples/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = get<Sample>('SELECT * FROM samples WHERE id = ?', [req.params.id])
    if (!existing) {
      res.status(404).json({ success: false, error: '样品不存在' })
      return
    }

    const {
      source, caseNo, sealNo, itemName, quantity, spec,
      retentionDays, retentionStart, retentionEnd, isInvolved,
      disposalDocNo,
    } = req.body

    if (sealNo !== undefined && sealNo.trim() === '') {
      res.status(400).json({ success: false, error: '封条号不能为空' })
      return
    }

    run(
      `UPDATE samples SET source = ?, case_no = ?, seal_no = ?, item_name = ?, quantity = ?, spec = ?,
       retention_days = ?, retention_start = ?, retention_end = ?, is_involved = ?, disposal_doc_no = ?
       WHERE id = ?`,
      [
        source ?? existing.source,
        caseNo ?? existing.caseNo,
        sealNo ?? existing.sealNo,
        itemName ?? existing.itemName,
        quantity ?? existing.quantity,
        spec ?? existing.spec,
        retentionDays ?? existing.retentionDays,
        retentionStart ?? existing.retentionStart,
        retentionEnd ?? existing.retentionEnd,
        isInvolved !== undefined ? (isInvolved ? 1 : 0) : existing.isInvolved,
        disposalDocNo ?? existing.disposalDocNo,
        req.params.id,
      ]
    )

    const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [req.params.id])
    res.json({ success: true, data: sample })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
