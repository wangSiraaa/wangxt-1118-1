import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { format, addDays } from 'date-fns'
import { all, get, run } from '../db.js'
import type { Sample, TestResult, Disposal, SampleCase, SealVersion, CaseInfo, SplitSample } from '../../shared/types.js'

const router = Router()

router.get('/samples', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, caseNo, isInvolved } = req.query
    let sql = 'SELECT * FROM samples WHERE 1=1'
    const params: unknown[] = []
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    if (caseNo) {
      sql += ' AND case_no LIKE ?'
      params.push(`%${caseNo}%`)
    }
    if (isInvolved !== undefined) {
      sql += ' AND is_involved = ?'
      params.push(isInvolved === 'true' ? 1 : 0)
    }
    sql += ' ORDER BY created_at DESC'
    const samples = all<Sample>(sql, params)

    const result = samples.map((sample) => {
      const cases = all<SampleCase>(
        'SELECT * FROM sample_cases WHERE sample_id = ? ORDER BY is_primary DESC, assigned_at ASC',
        [sample.id]
      )
      const sealVersions = all<SealVersion>(
        'SELECT * FROM seal_versions WHERE sample_id = ? ORDER BY version DESC',
        [sample.id]
      )
      return { ...sample, relatedCases: cases, sealVersions }
    })

    res.json({ success: true, data: result })
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
    const relatedCases = all<SampleCase>(
      'SELECT * FROM sample_cases WHERE sample_id = ? ORDER BY is_primary DESC, assigned_at ASC',
      [req.params.id]
    )
    const sealVersions = all<SealVersion>(
      'SELECT * FROM seal_versions WHERE sample_id = ? ORDER BY version DESC',
      [req.params.id]
    )
    const childSplits = all<SplitSample>(
      'SELECT * FROM split_samples WHERE parent_sample_id = ?',
      [req.params.id]
    )
    const parentSplit = get<SplitSample>(
      'SELECT * FROM split_samples WHERE child_sample_id = ?',
      [req.params.id]
    )
    res.json({
      success: true,
      data: {
        ...sample,
        testResults,
        disposals,
        relatedCases,
        sealVersions,
        childSplits,
        parentSplit,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.post('/samples', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      source, caseNo, sealNo, itemName, quantity, spec,
      retentionDays, retentionStart, retentionEnd, isInvolved,
      disposalDocNo, createdBy, relatedCases: caseList,
    } = req.body

    if (!sealNo || sealNo.trim() === '') {
      res.status(400).json({ success: false, error: '封条号不能为空' })
      return
    }

    if (!retentionStart || !retentionEnd) {
      res.status(400).json({ success: false, error: '留置起始日期和截止日期不能为空' })
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
      `INSERT INTO samples (id, sample_code, source, case_no, seal_no, seal_version, item_name, quantity, spec, retention_days, retention_start, retention_end, is_involved, disposal_doc_no, freeze_status, review_closed, parent_sample_id, status, created_by)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, '未冻结', 1, '', '待入库', ?)`,
      [
        id, sampleCode, source, caseNo, sealNo, itemName,
        quantity || 1, spec || '', retentionDays || 90,
        retentionStart, retentionEnd, isInvolved ? 1 : 0,
        disposalDocNo || '', createdBy || 'system',
      ]
    )

    run(
      `INSERT INTO seal_versions (id, sample_id, version, seal_no, change_reason, changed_by) VALUES (?, ?, 1, ?, ?, ?)`,
      [uuidv4(), id, sealNo, '初始登记', createdBy || 'system']
    )

    const primaryCaseId = uuidv4()
    let caseInfo = get<CaseInfo>('SELECT * FROM case_infos WHERE case_no = ?', [caseNo])
    if (!caseInfo && caseNo) {
      run(
        `INSERT INTO case_infos (id, case_no, case_name, created_by) VALUES (?, ?, ?, ?)`,
        [primaryCaseId, caseNo, caseNo, createdBy || 'system']
      )
      caseInfo = { id: primaryCaseId, caseNo, caseName: caseNo, caseType: '', handler: '', handlerDept: '', createdAt: '', createdBy: createdBy || 'system' }
    }
    if (caseInfo) {
      run(
        `INSERT INTO sample_cases (id, sample_id, case_id, case_no, is_primary, assigned_by) VALUES (?, ?, ?, ?, 1, ?)`,
        [uuidv4(), id, caseInfo.id, caseNo, createdBy || 'system']
      )
    }

    if (Array.isArray(caseList) && caseList.length > 0) {
      for (const c of caseList) {
        if (c.caseNo === caseNo) continue
        let cInfo = get<CaseInfo>('SELECT * FROM case_infos WHERE case_no = ?', [c.caseNo])
        if (!cInfo) {
          const cId = uuidv4()
          run(
            `INSERT INTO case_infos (id, case_no, case_name, created_by) VALUES (?, ?, ?, ?)`,
            [cId, c.caseNo, c.caseName || c.caseNo, createdBy || 'system']
          )
          cInfo = { id: cId, caseNo: c.caseNo, caseName: c.caseName || c.caseNo, caseType: '', handler: '', handlerDept: '', createdAt: '', createdBy: createdBy || 'system' }
        }
        run(
          `INSERT INTO sample_cases (id, sample_id, case_id, case_no, is_primary, assigned_by) VALUES (?, ?, ?, ?, 0, ?)`,
          [uuidv4(), id, cInfo.id, c.caseNo, createdBy || 'system']
        )
      }
    }

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '收样登记', ?, ?, ?)`,
      [uuidv4(), id, createdBy || 'system', '收样员', `样品 ${sampleCode} 登记入库，关联案件: ${caseNo}${Array.isArray(caseList) && caseList.length > 0 ? ' 等' + (caseList.length + 1) + '个案件' : ''}`]
    )

    const sample = get<Sample>('SELECT * FROM samples WHERE id = ?', [id])
    const relatedCases = all<SampleCase>('SELECT * FROM sample_cases WHERE sample_id = ?', [id])
    const sealVersions = all<SealVersion>('SELECT * FROM seal_versions WHERE sample_id = ?', [id])
    res.status(201).json({ success: true, data: { ...sample, relatedCases, sealVersions } })
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
      disposalDocNo, updatedBy,
    } = req.body

    if (sealNo !== undefined && sealNo.trim() === '') {
      res.status(400).json({ success: false, error: '封条号不能为空' })
      return
    }

    if (sealNo !== undefined && sealNo !== existing.sealNo) {
      const newVersion = (existing.sealVersion || 1) + 1
      run(
        `INSERT INTO seal_versions (id, sample_id, version, seal_no, change_reason, changed_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), req.params.id, newVersion, sealNo, '封签变更', updatedBy || existing.createdBy]
      )
      run(
        `UPDATE samples SET seal_version = ?, seal_no = ? WHERE id = ?`,
        [newVersion, sealNo, req.params.id]
      )
      run(
        `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '封签版本变更', ?, ?, ?)`,
        [uuidv4(), req.params.id, updatedBy || existing.createdBy, '收样员', `封签号由 ${existing.sealNo} 变更为 ${sealNo}，版本号 v${newVersion}`]
      )
    }

    const currentSealVersion = sealNo !== undefined && sealNo !== existing.sealNo
      ? (existing.sealVersion || 1) + 1
      : existing.sealVersion

    run(
      `UPDATE samples SET source = ?, case_no = ?, item_name = ?, quantity = ?, spec = ?,
       retention_days = ?, retention_start = ?, retention_end = ?, is_involved = ?, disposal_doc_no = ?
       WHERE id = ?`,
      [
        source ?? existing.source,
        caseNo ?? existing.caseNo,
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
    const relatedCases = all<SampleCase>('SELECT * FROM sample_cases WHERE sample_id = ?', [req.params.id])
    const sealVersions = all<SealVersion>('SELECT * FROM seal_versions WHERE sample_id = ?', [req.params.id])
    res.json({ success: true, data: { ...sample, relatedCases, sealVersions } })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.post('/samples/:id/add-case', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = get<Sample>('SELECT * FROM samples WHERE id = ?', [req.params.id])
    if (!existing) {
      res.status(404).json({ success: false, error: '样品不存在' })
      return
    }

    const { caseNo, caseName, isPrimary, assignedBy } = req.body
    if (!caseNo || caseNo.trim() === '') {
      res.status(400).json({ success: false, error: '案件编号不能为空' })
      return
    }

    const existingLink = get<SampleCase>(
      'SELECT * FROM sample_cases WHERE sample_id = ? AND case_no = ?',
      [req.params.id, caseNo]
    )
    if (existingLink) {
      res.status(400).json({ success: false, error: '该案件已关联此样品' })
      return
    }

    let caseInfo = get<CaseInfo>('SELECT * FROM case_infos WHERE case_no = ?', [caseNo])
    if (!caseInfo) {
      const cId = uuidv4()
      run(
        `INSERT INTO case_infos (id, case_no, case_name, created_by) VALUES (?, ?, ?, ?)`,
        [cId, caseNo, caseName || caseNo, assignedBy || existing.createdBy]
      )
      caseInfo = { id: cId, caseNo, caseName: caseName || caseNo, caseType: '', handler: '', handlerDept: '', createdAt: '', createdBy: assignedBy || existing.createdBy }
    }

    if (isPrimary) {
      run('UPDATE sample_cases SET is_primary = 0 WHERE sample_id = ?', [req.params.id])
    }

    run(
      `INSERT INTO sample_cases (id, sample_id, case_id, case_no, is_primary, assigned_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), req.params.id, caseInfo.id, caseNo, isPrimary ? 1 : 0, assignedBy || existing.createdBy]
    )

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '关联案件', ?, ?, ?)`,
      [uuidv4(), req.params.id, assignedBy || existing.createdBy, '收样员', `新增关联案件: ${caseNo}${isPrimary ? '（主案件）' : ''}`]
    )

    const relatedCases = all<SampleCase>('SELECT * FROM sample_cases WHERE sample_id = ? ORDER BY is_primary DESC', [req.params.id])
    res.json({ success: true, data: relatedCases })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.post('/samples/:id/split', async (req: Request, res: Response): Promise<void> => {
  try {
    const parentSample = get<Sample>('SELECT * FROM samples WHERE id = ?', [req.params.id])
    if (!parentSample) {
      res.status(404).json({ success: false, error: '母样不存在' })
      return
    }

    const { splitQuantity, splitReason, createdBy } = req.body
    if (!splitQuantity || splitQuantity <= 0) {
      res.status(400).json({ success: false, error: '分样数量必须大于0' })
      return
    }
    if (splitQuantity >= parentSample.quantity) {
      res.status(400).json({ success: false, error: '分样数量必须小于母样数量' })
      return
    }

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
    const childSampleCode = `${prefix}${seq.toString().padStart(4, '0')}`
    const childId = uuidv4()

    run(
      `INSERT INTO samples (id, sample_code, source, case_no, seal_no, seal_version, item_name, quantity, spec, retention_days, retention_start, retention_end, is_involved, disposal_doc_no, freeze_status, review_closed, parent_sample_id, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '在库', ?)`,
      [
        childId, childSampleCode, parentSample.source, parentSample.caseNo,
        parentSample.sealNo, parentSample.sealVersion, parentSample.itemName,
        splitQuantity, parentSample.spec, parentSample.retentionDays,
        parentSample.retentionStart, parentSample.retentionEnd,
        parentSample.isInvolved, parentSample.disposalDocNo, parentSample.freezeStatus,
        parentSample.reviewClosed ? 1 : 0, parentSample.id, createdBy || 'system',
      ]
    )

    run(
      `UPDATE samples SET quantity = quantity - ? WHERE id = ?`,
      [splitQuantity, req.params.id]
    )

    run(
      `INSERT INTO seal_versions (id, sample_id, version, seal_no, change_reason, changed_by) VALUES (?, ?, 1, ?, ?, ?)`,
      [uuidv4(), childId, parentSample.sealNo, '分样继承', createdBy || 'system']
    )

    const parentCases = all<SampleCase>('SELECT * FROM sample_cases WHERE sample_id = ?', [req.params.id])
    for (const pc of parentCases) {
      run(
        `INSERT INTO sample_cases (id, sample_id, case_id, case_no, is_primary, assigned_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), childId, pc.caseId, pc.caseNo, pc.isPrimary, createdBy || 'system']
      )
    }

    run(
      `INSERT INTO split_samples (id, parent_sample_id, child_sample_id, split_quantity, split_reason, split_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?, '已执行', ?)`,
      [uuidv4(), req.params.id, childId, splitQuantity, splitReason || '分样', new Date().toISOString().slice(0, 10), createdBy || 'system']
    )

    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '分样', ?, ?, ?)`,
      [uuidv4(), req.params.id, createdBy || 'system', '库管员', `拆分出子样 ${childSampleCode}，数量 ${splitQuantity}，原因: ${splitReason || '无'}`]
    )
    run(
      `INSERT INTO flow_traces (id, sample_id, action, operator, operator_role, comment) VALUES (?, ?, '分样生成', ?, ?, ?)`,
      [uuidv4(), childId, createdBy || 'system', '库管员', `由母样 ${parentSample.sampleCode} 拆分生成，数量 ${splitQuantity}`]
    )

    const childSample = get<Sample>('SELECT * FROM samples WHERE id = ?', [childId])
    res.status(201).json({ success: true, data: { parentSample: get<Sample>('SELECT * FROM samples WHERE id = ?', [req.params.id]), childSample } })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.get('/cases', async (req: Request, res: Response): Promise<void> => {
  try {
    const { keyword } = req.query
    let sql = 'SELECT * FROM case_infos WHERE 1=1'
    const params: unknown[] = []
    if (keyword) {
      sql += ' AND (case_no LIKE ? OR case_name LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`)
    }
    sql += ' ORDER BY created_at DESC'
    const cases = all<CaseInfo>(sql, params)
    res.json({ success: true, data: cases })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
