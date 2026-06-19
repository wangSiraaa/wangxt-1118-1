import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, XCircle, AlertCircle, Clock, Filter } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { DisposalType, DisposalStatus, Sample } from '@/types'
import { cn } from '@/lib/utils'

type MainTab = 'disposal' | 'extension' | 'split' | 'freeze' | 'approval' | 'history'
type FreezeSubTab = 'freeze' | 'unfreeze'

interface ValidationResultModal {
  canProceed: boolean
  freezeBlocked: boolean
  retention: { passed: boolean; message: string }
  doc: { passed: boolean; message: string }
  review: { passed: boolean; message: string }
}

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'disposal', label: '处置申请' },
  { key: 'extension', label: '延期申请' },
  { key: 'split', label: '分样管理' },
  { key: 'freeze', label: '涉案冻结' },
  { key: 'approval', label: '审批中心' },
  { key: 'history', label: '历史记录' },
]

const MAIN_TAB_COLORS: Record<MainTab, string> = {
  disposal: 'bg-deep-blue text-white',
  extension: 'bg-teal-600 text-white',
  split: 'bg-indigo-600 text-white',
  freeze: 'bg-rose-600 text-white',
  approval: 'bg-amber-600 text-white',
  history: 'bg-slate-600 text-white',
}

const DISPOSAL_TYPE_COLORS: Record<DisposalType, string> = {
  退样: 'bg-blue-50 text-blue-600 border-blue-200',
  销毁: 'bg-amber-50 text-amber-600 border-amber-200',
  延期: 'bg-teal-50 text-teal-600 border-teal-200',
  分样: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  冻结: 'bg-rose-50 text-rose-600 border-rose-200',
  解冻: 'bg-emerald-50 text-emerald-600 border-emerald-200',
}

const DISPOSAL_STATUS_COLORS: Record<DisposalStatus, string> = {
  待审批: 'bg-amber-50 text-amber-600 border-amber-200',
  已审批: 'bg-green-50 text-green-600 border-green-200',
  已执行: 'bg-blue-50 text-blue-600 border-blue-200',
  已驳回: 'bg-red-50 text-red-600 border-red-200',
}

const isRetentionExpired = (retentionEnd: string): { expired: boolean; daysDiff: number } => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(retentionEnd)
  endDate.setHours(0, 0, 0, 0)
  const daysDiff = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return { expired: daysDiff <= 0, daysDiff }
}

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function Disposal() {
  const {
    samples,
    disposals,
    extensions,
    freezeRecords,
    splitSamples,
    fetchSamples,
    fetchDisposals,
    fetchExtensions,
    fetchFreezeRecords,
    fetchSplitSamples,
    validateDisposal,
    createDisposal,
    approveDisposal,
    executeDisposal,
  } = useStore()

  const [activeTab, setActiveTab] = useState<MainTab>('disposal')
  const [freezeSubTab, setFreezeSubTab] = useState<FreezeSubTab>('freeze')
  const [historyFilter, setHistoryFilter] = useState<DisposalType | 'all'>('all')

  const [disposalForm, setDisposalForm] = useState({
    type: '退样' as Extract<DisposalType, '退样' | '销毁'>,
    sampleId: '',
    reason: '',
    destination: '',
    destroyMethod: '',
    witness: '',
    disposalDocNo: '',
  })
  const [validationResult, setValidationResult] = useState<ValidationResultModal | null>(null)
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [extensionForm, setExtensionForm] = useState({
    sampleId: '',
    extendedDays: 1,
    reason: '',
    approvalDoc: '',
  })

  const [splitForm, setSplitForm] = useState({
    parentSampleId: '',
    splitQuantity: 1,
    childSampleCode: '',
    splitReason: '',
  })

  const [freezeForm, setFreezeForm] = useState({
    sampleId: '',
    freezeType: '司法冻结' as '司法冻结' | '海关冻结' | '其他冻结',
    freezeOrderNo: '',
    freezeReason: '',
    freezeEndDate: '',
  })
  const [unfreezeForm, setUnfreezeForm] = useState({
    sampleId: '',
    unfreezeReason: '',
  })

  const [approveComment, setApproveComment] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchSamples()
    fetchDisposals()
    fetchExtensions()
    fetchFreezeRecords()
    fetchSplitSamples()
  }, [fetchSamples, fetchDisposals, fetchExtensions, fetchFreezeRecords, fetchSplitSamples])

  const disposalEligibleSamples = useMemo(() => {
    return samples.filter((s) => {
      const statusOk = s.status === '待处置' || s.status === '已检测' || s.status === '超期'
      return statusOk
    })
  }, [samples])

  const extensionEligibleSamples = useMemo(() => {
    return samples.filter((s) => {
      return s.status === '在库' || s.status === '已检测' || s.status === '超期'
    })
  }, [samples])

  const splitEligibleSamples = useMemo(() => {
    return samples.filter((s) => {
      const statusOk = s.status === '在库' || s.status === '已检测'
      return statusOk && s.quantity > 1 && !s.parentSampleId
    })
  }, [samples])

  const freezeEligibleSamples = useMemo(() => {
    return samples.filter((s) => s.freezeStatus === '未冻结')
  }, [samples])

  const unfreezeEligibleSamples = useMemo(() => {
    return samples.filter((s) => s.freezeStatus === '已冻结')
  }, [samples])

  const currentSample = samples.find((s) => s.id === disposalForm.sampleId) || null
  const currentExtensionSample = samples.find((s) => s.id === extensionForm.sampleId) || null
  const currentSplitParent = samples.find((s) => s.id === splitForm.parentSampleId) || null

  const handleValidate = async () => {
    if (!disposalForm.sampleId) return
    setValidating(true)
    try {
      const res = await validateDisposal({
        sampleId: disposalForm.sampleId,
        type: disposalForm.type,
        disposalDocNo: disposalForm.disposalDocNo,
      })
      if (res) {
        setValidationResult(res)
        setShowValidationModal(true)
      }
    } finally {
      setValidating(false)
    }
  }

  const handleCreateDisposal = async () => {
    setSubmitting(true)
    try {
      await createDisposal({
        type: disposalForm.type,
        sampleId: disposalForm.sampleId,
        reason: disposalForm.reason,
        destination: disposalForm.type === '退样' ? disposalForm.destination : undefined,
        destroyMethod: disposalForm.type === '销毁' ? disposalForm.destroyMethod : undefined,
        witness: disposalForm.type === '销毁' ? disposalForm.witness : undefined,
        disposalDocNo: disposalForm.disposalDocNo,
        validationRetentionPassed: validationResult?.retention.passed,
        validationDocPassed: validationResult?.doc.passed,
        validationReviewPassed: validationResult?.review.passed,
      })
      setDisposalForm({
        type: '退样',
        sampleId: '',
        reason: '',
        destination: '',
        destroyMethod: '',
        witness: '',
        disposalDocNo: '',
      })
      setValidationResult(null)
      setShowValidationModal(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateExtension = async () => {
    if (!extensionForm.sampleId || extensionForm.extendedDays <= 0) return
    setSubmitting(true)
    try {
      await createDisposal({
        type: '延期',
        sampleId: extensionForm.sampleId,
        extendedDays: extensionForm.extendedDays,
        newRetentionEnd: addDays(currentExtensionSample?.retentionEnd || new Date().toISOString(), extensionForm.extendedDays),
        reason: extensionForm.reason,
        approvalDoc: extensionForm.approvalDoc,
      })
      setExtensionForm({
        sampleId: '',
        extendedDays: 1,
        reason: '',
        approvalDoc: '',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSplit = async () => {
    if (!splitForm.parentSampleId || splitForm.splitQuantity <= 0) return
    if (currentSplitParent && splitForm.splitQuantity >= currentSplitParent.quantity) return
    setSubmitting(true)
    try {
      await createDisposal({
        type: '分样',
        sampleId: splitForm.parentSampleId,
        splitQuantity: splitForm.splitQuantity,
        splitToSampleCode: splitForm.childSampleCode || `${currentSplitParent?.sampleCode}-F1`,
        reason: splitForm.splitReason,
      })
      setSplitForm({
        parentSampleId: '',
        splitQuantity: 1,
        childSampleCode: '',
        splitReason: '',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleFreeze = async () => {
    if (!freezeForm.sampleId || !freezeForm.freezeOrderNo) return
    setSubmitting(true)
    try {
      await createDisposal({
        type: '冻结',
        sampleId: freezeForm.sampleId,
        freezeType: freezeForm.freezeType,
        freezeOrderNo: freezeForm.freezeOrderNo,
        freezeEndDate: freezeForm.freezeEndDate,
        reason: freezeForm.freezeReason,
      })
      setFreezeForm({
        sampleId: '',
        freezeType: '司法冻结',
        freezeOrderNo: '',
        freezeReason: '',
        freezeEndDate: '',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnfreeze = async () => {
    if (!unfreezeForm.sampleId) return
    setSubmitting(true)
    try {
      await createDisposal({
        type: '解冻',
        sampleId: unfreezeForm.sampleId,
        reason: unfreezeForm.unfreezeReason,
      })
      setUnfreezeForm({
        sampleId: '',
        unfreezeReason: '',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (id: string, approved: boolean) => {
    const comment = approveComment[id] || ''
    await approveDisposal(id, approved ? '已审批' : '已驳回', comment)
    setApproveComment((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleExecute = async (id: string) => {
    await executeDisposal(id)
  }

  const pendingApprovals = useMemo(() => {
    return disposals.filter((d) => d.status === '待审批')
  }, [disposals])

  const historyData = useMemo(() => {
    const filtered = historyFilter === 'all' ? disposals : disposals.filter((d) => d.type === historyFilter)
    return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [disposals, historyFilter])

  const renderSampleOptionLabel = (s: Sample, showRetention: boolean = true) => {
    const parts = [`${s.sampleCode} - ${s.itemName}`]
    if (showRetention) {
      const { expired, daysDiff } = isRetentionExpired(s.retentionEnd)
      if (daysDiff === 0) parts.push('[今日到期]')
      else if (expired) parts.push(`[超期${Math.abs(daysDiff)}天]`)
      else parts.push(`[剩${daysDiff}天]`)
    }
    if (s.isInvolved) parts.push('[涉案]')
    if (s.freezeStatus === '已冻结') parts.push('[已冻结]')
    if (s.freezeStatus === '已解冻') parts.push('[已解冻]')
    return parts.join(' ')
  }

  const retentionTags = (s: Sample) => {
    const tags: { label: string; className: string }[] = []
    const { expired, daysDiff } = isRetentionExpired(s.retentionEnd)
    if (daysDiff === 0) tags.push({ label: '今日到期', className: 'bg-amber-100 text-amber-700' })
    else if (expired) tags.push({ label: `超期${Math.abs(daysDiff)}天`, className: 'bg-red-100 text-red-700' })
    else tags.push({ label: `剩${daysDiff}天`, className: 'bg-green-100 text-green-700' })
    if (s.isInvolved) tags.push({ label: '涉案', className: 'bg-red-50 text-red-600' })
    if (s.freezeStatus === '已冻结') tags.push({ label: '已冻结', className: 'bg-rose-100 text-rose-700' })
    if (s.freezeStatus === '已解冻') tags.push({ label: '已解冻', className: 'bg-emerald-100 text-emerald-700' })
    return tags
  }

  const allValidationPassed = validationResult
    ? validationResult.retention.passed && validationResult.doc.passed && validationResult.review.passed
    : false

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.key
                ? MAIN_TAB_COLORS[tab.key]
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'disposal' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-5">处置申请</h3>

          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">处置类型</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="disposalType"
                  checked={disposalForm.type === '退样'}
                  onChange={() => setDisposalForm({ ...disposalForm, type: '退样' })}
                  className="w-4 h-4 text-deep-blue"
                />
                <span className="text-sm">退样</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="disposalType"
                  checked={disposalForm.type === '销毁'}
                  onChange={() => setDisposalForm({ ...disposalForm, type: '销毁' })}
                  className="w-4 h-4 text-deep-blue"
                />
                <span className="text-sm">销毁</span>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                选择样品 <span className="text-red-500">*</span>
              </label>
              <select
                value={disposalForm.sampleId}
                onChange={(e) => {
                  const sample = samples.find((s) => s.id === e.target.value)
                  setDisposalForm({
                    ...disposalForm,
                    sampleId: e.target.value,
                    disposalDocNo: sample?.isInvolved ? disposalForm.disposalDocNo : '',
                  })
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">请选择</option>
                {disposalEligibleSamples.map((s) => (
                  <option key={s.id} value={s.id}>
                    {renderSampleOptionLabel(s)}
                  </option>
                ))}
              </select>
              {currentSample && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {retentionTags(currentSample).map((t, i) => (
                    <span key={i} className={cn('text-xs px-2 py-0.5 rounded', t.className)}>
                      {t.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {disposalForm.sampleId && (
              <div>
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={validating}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm text-white transition-colors',
                    validating ? 'bg-slate-300' : 'bg-slate-600 hover:bg-slate-700'
                  )}
                >
                  {validating ? '校验中...' : '预校验'}
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">原因</label>
              <textarea
                value={disposalForm.reason}
                onChange={(e) => setDisposalForm({ ...disposalForm, reason: e.target.value })}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="请输入处置原因"
              />
            </div>

            {disposalForm.type === '退样' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">去向</label>
                <input
                  type="text"
                  value={disposalForm.destination}
                  onChange={(e) => setDisposalForm({ ...disposalForm, destination: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="退样去向"
                />
              </div>
            )}

            {disposalForm.type === '销毁' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">销毁方式</label>
                  <input
                    type="text"
                    value={disposalForm.destroyMethod}
                    onChange={(e) => setDisposalForm({ ...disposalForm, destroyMethod: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="如：焚烧、粉碎等"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">见证人</label>
                  <input
                    type="text"
                    value={disposalForm.witness}
                    onChange={(e) => setDisposalForm({ ...disposalForm, witness: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {currentSample?.isInvolved && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  处置批文号 <span className="text-red-500">*</span>
                  <span className="text-xs text-red-500 ml-1">（涉案样品必填）</span>
                </label>
                <input
                  type="text"
                  value={disposalForm.disposalDocNo}
                  onChange={(e) => setDisposalForm({ ...disposalForm, disposalDocNo: e.target.value })}
                  className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:ring-red-300"
                  placeholder="请输入处置批文号"
                />
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleCreateDisposal}
                disabled={submitting || !disposalForm.sampleId || !allValidationPassed}
                className={cn(
                  'px-5 py-2 rounded-lg text-sm text-white',
                  submitting || !disposalForm.sampleId || !allValidationPassed
                    ? 'bg-slate-300'
                    : 'bg-deep-blue hover:bg-deep-blue/90'
                )}
              >
                {submitting ? '提交中...' : '提交申请'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'extension' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-5">延期申请</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                选择样品 <span className="text-red-500">*</span>
              </label>
              <select
                value={extensionForm.sampleId}
                onChange={(e) =>
                  setExtensionForm({ ...extensionForm, sampleId: e.target.value })
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">请选择</option>
                {extensionEligibleSamples.map((s) => {
                  const { expired, daysDiff } = isRetentionExpired(s.retentionEnd)
                  const statusLabel =
                    s.status === '超期'
                      ? ' [超期]'
                      : s.status === '已检测'
                      ? ' [已检测]'
                      : ' [在库]'
                  const retentionLabel = expired ? ` [超期${Math.abs(daysDiff)}天]` : ` [剩${daysDiff}天]`
                  return (
                    <option key={s.id} value={s.id}>
                      {s.sampleCode} - {s.itemName}
                      {statusLabel}
                      {retentionLabel}
                    </option>
                  )
                })}
              </select>
              {currentExtensionSample && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded flex items-center gap-1',
                    'bg-blue-50 text-blue-600'
                  )}>
                    <Clock size={12} />
                    原截止: {currentExtensionSample.retentionEnd}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  延长天数 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={extensionForm.extendedDays}
                  onChange={(e) =>
                    setExtensionForm({
                      ...extensionForm,
                      extendedDays: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">新截止日期</label>
                <input
                  type="text"
                  readOnly
                  value={
                    currentExtensionSample
                      ? addDays(currentExtensionSample.retentionEnd, extensionForm.extendedDays)
                      : '-'
                  }
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">延期原因</label>
              <textarea
                value={extensionForm.reason}
                onChange={(e) => setExtensionForm({ ...extensionForm, reason: e.target.value })}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="请输入延期原因"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">审批文档号</label>
              <input
                type="text"
                value={extensionForm.approvalDoc}
                onChange={(e) => setExtensionForm({ ...extensionForm, approvalDoc: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="请输入审批文档号"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleCreateExtension}
                disabled={submitting || !extensionForm.sampleId}
                className={cn(
                  'px-5 py-2 rounded-lg text-sm text-white',
                  submitting || !extensionForm.sampleId
                    ? 'bg-slate-300'
                    : 'bg-teal-600 hover:bg-teal-700'
                )}
              >
                {submitting ? '提交中...' : '提交申请'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'split' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-5">分样管理</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  选择母样 <span className="text-red-500">*</span>
                </label>
                <select
                  value={splitForm.parentSampleId}
                  onChange={(e) => {
                    const sample = samples.find((s) => s.id === e.target.value)
                    setSplitForm({
                      ...splitForm,
                      parentSampleId: e.target.value,
                      splitQuantity: sample ? Math.min(1, sample.quantity - 1) : 1,
                      childSampleCode: sample ? `${sample.sampleCode}-F1` : '',
                    })
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">请选择（在库/已检测，数量需大于1）</option>
                  {splitEligibleSamples.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sampleCode} - {s.itemName} [数量:{s.quantity}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    分样数量 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    max={currentSplitParent ? currentSplitParent.quantity - 1 : undefined}
                    value={splitForm.splitQuantity}
                    onChange={(e) =>
                      setSplitForm({
                        ...splitForm,
                        splitQuantity: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className={cn(
                      'w-full border rounded-lg px-3 py-2 text-sm',
                      currentSplitParent && splitForm.splitQuantity >= currentSplitParent.quantity
                        ? 'border-red-300 focus:ring-red-300'
                        : 'border-slate-300'
                    )}
                  />
                  {currentSplitParent && (
                    <p className="mt-1 text-xs text-slate-500">
                      母样数量: {currentSplitParent.quantity}，分样后剩余:{' '}
                      <span
                        className={cn(
                          splitForm.splitQuantity >= currentSplitParent.quantity
                            ? 'text-red-600 font-medium'
                            : 'text-slate-700 font-medium'
                        )}
                      >
                        {currentSplitParent.quantity - splitForm.splitQuantity}
                      </span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">子样编号</label>
                  <input
                    type="text"
                    value={splitForm.childSampleCode}
                    onChange={(e) => setSplitForm({ ...splitForm, childSampleCode: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="可自动生成，也可手填"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">分样原因</label>
                <textarea
                  value={splitForm.splitReason}
                  onChange={(e) => setSplitForm({ ...splitForm, splitReason: e.target.value })}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="请输入分样原因"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSplit}
                  disabled={
                    submitting ||
                    !splitForm.parentSampleId ||
                    (currentSplitParent != null && splitForm.splitQuantity >= currentSplitParent.quantity)
                  }
                  className={cn(
                    'px-5 py-2 rounded-lg text-sm text-white',
                    submitting ||
                    !splitForm.parentSampleId ||
                    (currentSplitParent != null && splitForm.splitQuantity >= currentSplitParent.quantity)
                      ? 'bg-slate-300'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  )}
                >
                  {submitting ? '提交中...' : '提交分样'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">分样记录</h3>
            </div>
            {splitSamples.length === 0 ? (
              <div className="py-12 text-center text-slate-400">暂无分样记录</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="px-5 py-3 text-left font-medium">母样编号</th>
                      <th className="px-5 py-3 text-left font-medium">子样编号</th>
                      <th className="px-5 py-3 text-left font-medium">分样数量</th>
                      <th className="px-5 py-3 text-left font-medium">分样原因</th>
                      <th className="px-5 py-3 text-left font-medium">分样日期</th>
                      <th className="px-5 py-3 text-left font-medium">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {splitSamples.map((ss) => {
                      const parent = samples.find((s) => s.id === ss.parentSampleId)
                      const child = samples.find((s) => s.id === ss.childSampleId)
                      return (
                        <tr key={ss.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium">
                            {parent?.sampleCode || ss.parentSampleId}
                          </td>
                          <td className="px-5 py-3 font-medium text-indigo-600">
                            {child?.sampleCode || ss.splitToSampleCode || ss.childSampleId}
                          </td>
                          <td className="px-5 py-3">{ss.splitQuantity}</td>
                          <td className="px-5 py-3 text-slate-600">{ss.splitReason || '-'}</td>
                          <td className="px-5 py-3 text-slate-500">{ss.splitDate || ss.createdAt}</td>
                          <td className="px-5 py-3">
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded-full border',
                                ss.status === '已执行'
                                  ? 'bg-green-50 text-green-600 border-green-200'
                                  : ss.status === '已审批'
                                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                                  : 'bg-amber-50 text-amber-600 border-amber-200'
                              )}
                            >
                              {ss.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'freeze' && (
        <div className="space-y-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFreezeSubTab('freeze')}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-medium transition-colors',
                freezeSubTab === 'freeze'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
              )}
            >
              冻结
            </button>
            <button
              onClick={() => setFreezeSubTab('unfreeze')}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-medium transition-colors',
                freezeSubTab === 'unfreeze'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
              )}
            >
              解冻
            </button>
          </div>

          {freezeSubTab === 'freeze' && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-5">样品冻结</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    选择样品 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={freezeForm.sampleId}
                    onChange={(e) => setFreezeForm({ ...freezeForm, sampleId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">请选择（仅显示未冻结样品）</option>
                    {freezeEligibleSamples.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sampleCode} - {s.itemName}
                        {s.isInvolved ? ' [涉案]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    冻结类型 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={freezeForm.freezeType}
                    onChange={(e) =>
                      setFreezeForm({
                        ...freezeForm,
                        freezeType: e.target.value as '司法冻结' | '海关冻结' | '其他冻结',
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="司法冻结">司法冻结</option>
                    <option value="海关冻结">海关冻结</option>
                    <option value="其他冻结">其他冻结</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    冻结文书号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={freezeForm.freezeOrderNo}
                    onChange={(e) => setFreezeForm({ ...freezeForm, freezeOrderNo: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="请输入冻结文书号"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">冻结原因</label>
                  <textarea
                    value={freezeForm.freezeReason}
                    onChange={(e) => setFreezeForm({ ...freezeForm, freezeReason: e.target.value })}
                    rows={2}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="请输入冻结原因"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">冻结截止日期</label>
                  <input
                    type="date"
                    value={freezeForm.freezeEndDate}
                    onChange={(e) => setFreezeForm({ ...freezeForm, freezeEndDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleFreeze}
                    disabled={submitting || !freezeForm.sampleId || !freezeForm.freezeOrderNo}
                    className={cn(
                      'px-5 py-2 rounded-lg text-sm text-white',
                      submitting || !freezeForm.sampleId || !freezeForm.freezeOrderNo
                        ? 'bg-slate-300'
                        : 'bg-rose-600 hover:bg-rose-700'
                    )}
                  >
                    {submitting ? '提交中...' : '提交冻结'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {freezeSubTab === 'unfreeze' && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-5">样品解冻</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    选择样品 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={unfreezeForm.sampleId}
                    onChange={(e) => setUnfreezeForm({ ...unfreezeForm, sampleId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">请选择（仅显示冻结中样品）</option>
                    {unfreezeEligibleSamples.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sampleCode} - {s.itemName}
                        {s.isInvolved ? ' [涉案]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">解冻原因</label>
                  <textarea
                    value={unfreezeForm.unfreezeReason}
                    onChange={(e) => setUnfreezeForm({ ...unfreezeForm, unfreezeReason: e.target.value })}
                    rows={2}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="请输入解冻原因"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleUnfreeze}
                    disabled={submitting || !unfreezeForm.sampleId}
                    className={cn(
                      'px-5 py-2 rounded-lg text-sm text-white',
                      submitting || !unfreezeForm.sampleId
                        ? 'bg-slate-300'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    )}
                  >
                    {submitting ? '提交中...' : '提交解冻'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">冻结记录</h3>
            </div>
            {freezeRecords.length === 0 ? (
              <div className="py-12 text-center text-slate-400">暂无冻结记录</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="px-5 py-3 text-left font-medium">样品编号</th>
                      <th className="px-5 py-3 text-left font-medium">冻结类型</th>
                      <th className="px-5 py-3 text-left font-medium">文书号</th>
                      <th className="px-5 py-3 text-left font-medium">冻结起始</th>
                      <th className="px-5 py-3 text-left font-medium">冻结截止</th>
                      <th className="px-5 py-3 text-left font-medium">状态</th>
                      <th className="px-5 py-3 text-left font-medium">解冻时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {freezeRecords.map((fr) => {
                      const sample = samples.find((s) => s.id === fr.sampleId)
                      return (
                        <tr key={fr.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium">
                            {sample?.sampleCode || fr.sampleId}
                          </td>
                          <td className="px-5 py-3">{fr.freezeType}</td>
                          <td className="px-5 py-3 text-slate-600">{fr.freezeOrderNo}</td>
                          <td className="px-5 py-3 text-slate-500">{fr.freezeStartDate}</td>
                          <td className="px-5 py-3 text-slate-500">{fr.freezeEndDate}</td>
                          <td className="px-5 py-3">
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded-full border',
                                fr.status === '已冻结'
                                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                                  : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              )}
                            >
                              {fr.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-500">{fr.unfreezeDate || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'approval' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">审批中心</h3>
            <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600 font-medium">
              {pendingApprovals.length} 条待审批
            </span>
          </div>
          {disposals.length === 0 ? (
            <div className="py-12 text-center text-slate-400">暂无审批记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="px-5 py-3 text-left font-medium">申请类型</th>
                    <th className="px-5 py-3 text-left font-medium">样品</th>
                    <th className="px-5 py-3 text-left font-medium">申请人</th>
                    <th className="px-5 py-3 text-left font-medium">申请时间</th>
                    <th className="px-5 py-3 text-left font-medium">状态</th>
                    <th className="px-5 py-3 text-left font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {disposals.map((d) => {
                    const sample = samples.find((s) => s.id === d.sampleId)
                    const isExecutable =
                      d.status === '已审批' &&
                      (d.type === '退样' || d.type === '销毁' || d.type === '冻结' || d.type === '解冻')
                    return (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full border',
                              DISPOSAL_TYPE_COLORS[d.type]
                            )}
                          >
                            {d.type}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-medium">{sample?.sampleCode || d.sampleId}</div>
                          <div className="text-xs text-slate-500">{sample?.itemName}</div>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{d.createdBy || '-'}</td>
                        <td className="px-5 py-3 text-slate-500">{d.createdAt}</td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full border',
                              DISPOSAL_STATUS_COLORS[d.status]
                            )}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {d.status === '待审批' && (
                            <div className="flex flex-col gap-2">
                              <input
                                type="text"
                                placeholder="审批意见"
                                value={approveComment[d.id] || ''}
                                onChange={(e) =>
                                  setApproveComment({
                                    ...approveComment,
                                    [d.id]: e.target.value,
                                  })
                                }
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs w-full"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApprove(d.id, true)}
                                  className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700"
                                >
                                  通过
                                </button>
                                <button
                                  onClick={() => handleApprove(d.id, false)}
                                  className="flex-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700"
                                >
                                  驳回
                                </button>
                              </div>
                            </div>
                          )}
                          {isExecutable && (
                            <button
                              onClick={() => handleExecute(d.id)}
                              className="px-4 py-1.5 bg-deep-blue text-white rounded-lg text-xs hover:bg-deep-blue/90"
                            >
                              执行
                            </button>
                          )}
                          {d.status === '待审批' || isExecutable ? null : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-semibold text-slate-800">历史记录</h3>
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-500" />
              <select
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value as DisposalType | 'all')}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs"
              >
                <option value="all">全部类型</option>
                <option value="退样">退样</option>
                <option value="销毁">销毁</option>
                <option value="延期">延期</option>
                <option value="分样">分样</option>
                <option value="冻结">冻结</option>
                <option value="解冻">解冻</option>
              </select>
            </div>
          </div>
          {historyData.length === 0 ? (
            <div className="py-12 text-center text-slate-400">暂无历史记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="px-5 py-3 text-left font-medium">申请类型</th>
                    <th className="px-5 py-3 text-left font-medium">样品</th>
                    <th className="px-5 py-3 text-left font-medium">原因/备注</th>
                    <th className="px-5 py-3 text-left font-medium">三重校验</th>
                    <th className="px-5 py-3 text-left font-medium">申请人</th>
                    <th className="px-5 py-3 text-left font-medium">审批人</th>
                    <th className="px-5 py-3 text-left font-medium">申请时间</th>
                    <th className="px-5 py-3 text-left font-medium">执行状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {historyData.map((d) => {
                    const sample = samples.find((s) => s.id === d.sampleId)
                    const hasValidation =
                      d.validationRetentionPassed !== undefined ||
                      d.validationDocPassed !== undefined ||
                      d.validationReviewPassed !== undefined
                    return (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full border',
                              DISPOSAL_TYPE_COLORS[d.type]
                            )}
                          >
                            {d.type}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-medium">{sample?.sampleCode || d.sampleId}</div>
                          <div className="text-xs text-slate-500">{sample?.itemName}</div>
                        </td>
                        <td className="px-5 py-3 text-slate-600 max-w-xs truncate">
                          {d.reason || '-'}
                        </td>
                        <td className="px-5 py-3">
                          {hasValidation ? (
                            <div className="flex items-center gap-1">
                              <span className="flex items-center" title="留置期校验">
                                {d.validationRetentionPassed ? (
                                  <CheckCircle2 size={16} className="text-green-500" />
                                ) : d.validationRetentionPassed === false ? (
                                  <XCircle size={16} className="text-red-500" />
                                ) : (
                                  <AlertCircle size={16} className="text-amber-500" />
                                )}
                              </span>
                              <span className="flex items-center" title="批文校验">
                                {d.validationDocPassed ? (
                                  <CheckCircle2 size={16} className="text-green-500" />
                                ) : d.validationDocPassed === false ? (
                                  <XCircle size={16} className="text-red-500" />
                                ) : (
                                  <AlertCircle size={16} className="text-amber-500" />
                                )}
                              </span>
                              <span className="flex items-center" title="复核闭环校验">
                                {d.validationReviewPassed ? (
                                  <CheckCircle2 size={16} className="text-green-500" />
                                ) : d.validationReviewPassed === false ? (
                                  <XCircle size={16} className="text-red-500" />
                                ) : (
                                  <AlertCircle size={16} className="text-amber-500" />
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{d.createdBy || '-'}</td>
                        <td className="px-5 py-3 text-slate-600">
                          {d.status !== '待审批' ? d.approvedBy || '-' : '-'}
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{d.createdAt}</td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full border',
                              DISPOSAL_STATUS_COLORS[d.status]
                            )}
                          >
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showValidationModal && validationResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-lg">处置前校验结果</h3>
            </div>
            <div className="p-6 space-y-4">
              <div
                className={cn(
                  'px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2',
                  allValidationPassed
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                )}
              >
                {allValidationPassed ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <XCircle size={18} />
                )}
                {allValidationPassed ? '全部校验通过，可以提交申请' : '存在未通过项，请修正后再提交'}
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: '留置期校验',
                    result: validationResult.retention,
                  },
                  {
                    label: '批文校验',
                    result: validationResult.doc,
                  },
                  {
                    label: '复核闭环校验',
                    result: validationResult.review,
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border',
                      item.result.passed
                        ? 'bg-green-50/50 border-green-100'
                        : 'bg-red-50/50 border-red-100'
                    )}
                  >
                    {item.result.passed ? (
                      <CheckCircle2 size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">{item.label}</div>
                      <div
                        className={cn(
                          'text-xs mt-0.5',
                          item.result.passed ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {item.result.message}
                      </div>
                    </div>
                  </div>
                ))}

                {validationResult.freezeBlocked && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-amber-50/50 border-amber-100">
                    <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">样品状态异常</div>
                      <div className="text-xs mt-0.5 text-amber-600">样品当前处于冻结状态，无法处置</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateDisposal}
                disabled={!allValidationPassed || submitting}
                className={cn(
                  'px-5 py-2 rounded-lg text-sm text-white',
                  !allValidationPassed || submitting
                    ? 'bg-slate-300'
                    : 'bg-deep-blue hover:bg-deep-blue/90'
                )}
              >
                {submitting ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
