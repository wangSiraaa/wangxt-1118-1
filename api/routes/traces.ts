import { Router, type Request, type Response } from 'express'
import { all } from '../db.js'
import type { FlowTrace } from '../../shared/types.js'

const router = Router()

router.get('/samples/:id/trace', async (req: Request, res: Response): Promise<void> => {
  try {
    const traces = all<FlowTrace>(
      'SELECT * FROM flow_traces WHERE sample_id = ? ORDER BY created_at ASC',
      [req.params.id]
    )
    res.json({ success: true, data: traces })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
