import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { DisposalType } from '@/types'
import { cn } from '@/lib/utils'

export default function Disposal() {
  const { samples, disposals, fetchSamples, fetchDisposals, createDisposal, approveDisposal, currentUser } = useStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<DisposalType>('退样')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    sampleId: '',
    type: '退样' as DisposalType,
    reason: '',
    destination: '',
    destroyMethod: '',
    witness: '',
    disposalDocNo: '',
  })
  const [approveComment, setApproveComment] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSamples()
    fetchDisposals()
  }, [fetchSamples, fetchDisposals])

  const isRetentionExpired = (retentionEnd: string): { expired: boolean; daysDiff: number } => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = new Date(retentionEnd)
    endDate.setHours(0, 0, 0, 0)
    const daysDiff = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return { expired: daysDiff <= 0, daysDiff }
  }

  const eligibleSamples = samples.filter((s) => {
    const statusOk = s.status === '待处置' || s.status === '已检测' || s.status === '超期'
    const { expired } = isRetentionExpired(s.retentionEnd)
    return statusOk && expired
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const sample = samples.find((s) => s.id === form.sampleId)
    if (sample?.isInvolved && !form.disposalDocNo.trim()) {
      setError('涉案样品必须填写处置批文号')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await createDisposal(form)
      setShowForm(false)
      setForm({
        sampleId: '',
        type: activeTab,
        reason: '',
        destination: '',
        destroyMethod: '',
        witness: '',
        disposalDocNo: '',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (id: string, approved: boolean) => {
    const comment = approveComment[id] || ''
    await approveDisposal(id, approved ? '已审批' : '待审批', comment)
    setApproveComment((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const pendingApprovals = disposals.filter((d) => d.status === '待审批')
  const tabDisposals = disposals.filter((d) => d.type === activeTab)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('退样')}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === '退样'
                ? 'bg-deep-blue text-white'
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
            )}
          >
            退样
          </button>
          <button
            onClick={() => setActiveTab('销毁')}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === '销毁'
                ? 'bg-amber-600 text-white'
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
            )}
          >
            销毁
          </button>
        </div>
        <button
          onClick={() => {
            setShowForm(true)
            setForm({ ...form, type: activeTab })
          }}
          className="px-4 py-2 bg-deep-blue text-white rounded-lg text-sm hover:bg-deep-blue/90"
        >
          新增{activeTab}申请
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-4">
            新增{form.type}申请
          </h3>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  选择样品 <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.sampleId}
                  onChange={(e) => {
                    const sample = samples.find((s) => s.id === e.target.value)
                    setForm({
                      ...form,
                      sampleId: e.target.value,
                      disposalDocNo: sample?.isInvolved ? form.disposalDocNo : '',
                    })
                  }}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">请选择</option>
                  {eligibleSamples.map((s) => {
                    const { daysDiff } = isRetentionExpired(s.retentionEnd)
                    const retentionLabel = daysDiff === 0 ? ' [今日到期]' : ` [超期${Math.abs(daysDiff)}天]`
                    return (
                      <option key={s.id} value={s.id}>
                        {s.sampleCode} - {s.itemName}
                        {s.isInvolved ? ' [涉案]' : ''}
                        {retentionLabel}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">处置类型</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as DisposalType })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="退样">退样</option>
                  <option value="销毁">销毁</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">原因</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="请输入处置原因"
              />
            </div>
            {form.type === '退样' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">去向</label>
                <input
                  type="text"
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="退样去向"
                />
              </div>
            )}
            {form.type === '销毁' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">销毁方式</label>
                  <input
                    type="text"
                    value={form.destroyMethod}
                    onChange={(e) => setForm({ ...form, destroyMethod: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="如：焚烧、粉碎等"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">见证人</label>
                  <input
                    type="text"
                    value={form.witness}
                    onChange={(e) => setForm({ ...form, witness: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
            {(() => {
              const sample = samples.find((s) => s.id === form.sampleId)
              return sample?.isInvolved ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    处置批文号 <span className="text-red-500">*</span>
                    <span className="text-xs text-red-500 ml-1">（涉案样品必填）</span>
                  </label>
                  <input
                    type="text"
                    value={form.disposalDocNo}
                    onChange={(e) => setForm({ ...form, disposalDocNo: e.target.value })}
                    className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:ring-red-300"
                    placeholder="请输入处置批文号"
                  />
                </div>
              ) : null
            })()}
            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  'px-5 py-2 rounded-lg text-sm text-white',
                  submitting ? 'bg-slate-300' : 'bg-deep-blue hover:bg-deep-blue/90'
                )}
              >
                {submitting ? '提交中...' : '提交申请'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{activeTab}记录</h2>
        </div>
        {tabDisposals.length === 0 ? (
          <div className="py-12 text-center text-slate-400">暂无{activeTab}记录</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {tabDisposals.map((d) => {
              const sample = samples.find((s) => s.id === d.sampleId)
              return (
                <div
                  key={d.id}
                  className="px-5 py-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => d.sampleId && navigate(`/trace/${d.sampleId}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        d.type === '退样' ? 'bg-blue-500' : 'bg-amber-500'
                      )} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{sample?.sampleCode || d.sampleId}</span>
                          <span className="text-xs text-slate-500">{sample?.itemName}</span>
                          {sample?.isInvolved && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">涉案</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{d.reason}</p>
                      </div>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      d.status === '待审批' ? 'bg-amber-50 text-amber-600' :
                      d.status === '已审批' ? 'bg-green-50 text-green-600' :
                      'bg-slate-50 text-slate-600'
                    )}>
                      {d.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {pendingApprovals.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">待审批</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {pendingApprovals.map((d) => {
              const sample = samples.find((s) => s.id === d.sampleId)
              return (
                <div key={d.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        d.type === '退样' ? 'bg-blue-500' : 'bg-amber-500'
                      )} />
                      <span className="font-medium text-sm">{sample?.sampleCode || d.sampleId}</span>
                      <span className="text-xs text-slate-500">{sample?.itemName}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">{d.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="审批意见"
                      value={approveComment[d.id] || ''}
                      onChange={(e) =>
                        setApproveComment({ ...approveComment, [d.id]: e.target.value })
                      }
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleApprove(d.id, true)
                      }}
                      className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700"
                    >
                      通过
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleApprove(d.id, false)
                      }}
                      className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700"
                    >
                      驳回
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
