import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { all, get, run } from '../db.js'
import type { Sample, Disposal } from '../../shared/types.js'

const router = Router()

router.get('/disposals', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, sampleId } = req.query
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
    sql += ' ORDER BY created_at DESC'
    const disposals = all<Disposal>(sql, params)
    res.json({ success: true, data: disposals })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.post('/disposals', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      sampleId, type, reason, destination, destroyMethod,
      witness, disposalDocNo, createdBy,
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

    if (!['已检测', '待处置', '超期'].includes(sample.status)) {
      res.status(400).json({ success: false, error: `样品当前状态为"${sample.status}"，无法发起处置` })
      return
    }

    if (sample.isInvolved && (!disposalDocNo || disposalDocNo.trim() === '')) {
      res.status(400).json({ success: false, error: '涉案样品必须填写处置文书号' })
      return
    }

    const id = uuidv4()

    run(
      `INSERT INTO disposals (id, sample_id, type, reason, destination, destroy_method, witness, disposal_doc_no, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '待审批', ?)`,
      [
        id, sampleId, type, reason || '', destination || '',
        destroyMethod || '', witness || '', disposalDocNo || '',
        createdBy || 'system',
      ]
    )

    run("UPDATE samples SET status = '待处置' WHERE id = ?", [sampleId])

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '发起处置', ?, ?, ?)`,
      [
        uuidv4(), sampleId, createdBy || 'system', '操作员',
        `处置类型: ${type}，原因: ${reason || '无'}`,
      ]
    )

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

    run("UPDATE samples SET status = '处置中' WHERE id = ?", [disposal.sampleId])

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '处置审批', ?, ?, ?)`,
      [
        uuidv4(), disposal.sampleId, approvedBy || 'system', '审批人',
        `处置审批通过${approvalComment ? '，意见: ' + approvalComment : ''}`,
      ]
    )

    const updatedDisposal = get<Disposal>('SELECT * FROM disposals WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updatedDisposal })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
