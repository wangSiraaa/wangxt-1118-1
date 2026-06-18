import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { all, get, run } from '../db.js'
import type { Sample, Warehouse } from '../../shared/types.js'

const router = Router()

router.get('/warehouses', async (req: Request, res: Response): Promise<void> => {
  try {
    const warehouses = all<Warehouse>('SELECT * FROM warehouses ORDER BY code')
    res.json({ success: true, data: warehouses })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.post('/warehouses/allocate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sampleId, warehouseId } = req.body
    if (!sampleId || !warehouseId) {
      res.status(400).json({ success: false, error: '样品ID和库位ID不能为空' })
      return
    }

    const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [sampleId])
    if (!sample) {
      res.status(404).json({ success: false, error: '样品不存在' })
      return
    }

    const warehouse = get<Warehouse>('SELECT * FROM warehouses WHERE id = ?', [warehouseId])
    if (!warehouse) {
      res.status(404).json({ success: false, error: '库位不存在' })
      return
    }

    if (warehouse.status !== '空闲') {
      res.status(400).json({ success: false, error: '该库位当前非空闲状态' })
      return
    }

    run('UPDATE samples SET warehouse_id = ? WHERE id = ?', [warehouseId, sampleId])
    run("UPDATE warehouses SET status = '占用', current_sample_id = ? WHERE id = ?", [sampleId, warehouseId])

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '分配库位', ?, ?, ?)`,
      [
        uuidv4(), sampleId, 'system', '系统',
        `分配至库位 ${warehouse.code} (${warehouse.name})`,
      ]
    )

    const updatedSample = get<Sample>('SELECT * FROM samples WHERE id = ?', [sampleId])
    res.json({ success: true, data: updatedSample })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.put('/samples/:id/confirm-in', async (req: Request, res: Response): Promise<void> => {
  try {
    const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [req.params.id])
    if (!sample) {
      res.status(404).json({ success: false, error: '样品不存在' })
      return
    }

    if (sample.status !== '待入库') {
      res.status(400).json({ success: false, error: `样品当前状态为"${sample.status}"，无法进行入库确认` })
      return
    }

    if (!sample.sealNo || sample.sealNo.trim() === '') {
      res.status(400).json({ success: false, error: '封条号不能为空，无法确认入库' })
      return
    }

    if (!sample.warehouseId) {
      res.status(400).json({ success: false, error: '尚未分配库位，无法确认入库' })
      return
    }

    const { operator } = req.body

    run("UPDATE samples SET status = '在库' WHERE id = ?", [req.params.id])

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '入库确认', ?, ?, ?)`,
      [
        uuidv4(), req.params.id, operator || 'system', '库管员',
        `样品已入库，封条号: ${sample.sealNo}`,
      ]
    )

    const updatedSample = get<Sample>('SELECT * FROM samples WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updatedSample })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
