import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { SampleSource } from '@/types'
import { cn } from '@/lib/utils'
import { format, addDays } from 'date-fns'

export default function Register() {
  const { createSample, currentUser } = useStore()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    source: '执法扣留' as SampleSource,
    caseNo: '',
    sealNo: '',
    itemName: '',
    quantity: 1,
    spec: '',
    retentionDays: 90,
    isInvolved: false,
    disposalDocNo: '',
  })
  const [sealNoValid, setSealNoValid] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const retentionStart = format(new Date(), 'yyyy-MM-dd')
  const retentionEnd = format(addDays(new Date(), form.retentionDays), 'yyyy-MM-dd')

  useEffect(() => {
    if (form.sealNo.trim()) {
      setSealNoValid(true)
    } else {
      setSealNoValid(false)
    }
  }, [form.sealNo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.sealNo.trim()) {
      setError('封签号不能为空，请填写封签号后方可提交')
      return
    }
    if (form.isInvolved && !form.disposalDocNo.trim()) {
      setError('涉案样品必须填写处置批文号')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const result = await createSample({
        source: form.source,
        caseNo: form.caseNo,
        sealNo: form.sealNo,
        itemName: form.itemName,
        quantity: form.quantity,
        spec: form.spec,
        retentionDays: form.retentionDays,
        retentionStart,
        retentionEnd,
        isInvolved: form.isInvolved,
        disposalDocNo: form.disposalDocNo,
        createdBy: currentUser.name,
      } as any)
      if (result) {
        setSuccess(result.sampleCode)
        setForm({
          source: '执法扣留',
          caseNo: '',
          sealNo: '',
          itemName: '',
          quantity: 1,
          spec: '',
          retentionDays: 90,
          isInvolved: false,
          disposalDocNo: '',
        })
        setSealNoValid(null)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-lg">收样登记</h2>
          <p className="text-sm text-slate-500 mt-0.5">录入扣样来源、封签号及样品基本信息</p>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 size={16} />
            登记成功！样品编号：<strong>{success}</strong>
          </div>
        )}

        {!form.sealNo.trim() && form.sealNo !== '' && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle size={16} className="animate-pulse" />
            封签号缺失，无法提交入库申请
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                扣样来源 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as SampleSource })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
              >
                <option value="执法扣留">执法扣留</option>
                <option value="检验抽样">检验抽样</option>
                <option value="抽查取样">抽查取样</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                案件编号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.caseNo}
                onChange={(e) => setForm({ ...form, caseNo: e.target.value })}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                placeholder="请输入案件编号"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              封签号 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={form.sealNo}
                onChange={(e) => setForm({ ...form, sealNo: e.target.value })}
                className={cn(
                  'w-full border rounded-lg px-4 py-3 text-lg font-mono tracking-wider focus:outline-none focus:ring-2',
                  sealNoValid === true
                    ? 'border-green-300 focus:ring-green-500/30 bg-green-50/30'
                    : sealNoValid === false
                    ? 'border-red-300 focus:ring-red-500/30 bg-red-50/30'
                    : 'border-slate-300 focus:ring-deep-blue/30 focus:border-deep-blue'
                )}
                placeholder="请输入封签号"
              />
              {sealNoValid === true && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={20} />
              )}
              {sealNoValid === false && form.sealNo !== '' && (
                <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 animate-[shake_0.3s_ease-in-out]" size={20} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                样品名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">数量</label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 1 })}
                min={1}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">规格</label>
              <input
                type="text"
                value={form.spec}
                onChange={(e) => setForm({ ...form, spec: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">留置天数</label>
              <input
                type="number"
                value={form.retentionDays}
                onChange={(e) => setForm({ ...form, retentionDays: Number(e.target.value) || 90 })}
                min={1}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">留置起始日期</label>
              <input
                type="text"
                value={retentionStart}
                readOnly
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">留置截止日期</label>
              <input
                type="text"
                value={retentionEnd}
                readOnly
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500"
              />
            </div>
          </div>

          <div className="flex items-start gap-8 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isInvolved}
                onChange={(e) => setForm({ ...form, isInvolved: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-deep-blue focus:ring-deep-blue"
              />
              <span className="text-sm text-slate-700">是否涉案</span>
            </label>
            {form.isInvolved && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  处置批文号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.disposalDocNo}
                  onChange={(e) => setForm({ ...form, disposalDocNo: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                  placeholder="涉案样品必填"
                />
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-5 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !form.sealNo.trim()}
              className={cn(
                'px-6 py-2 rounded-lg text-sm text-white font-medium',
                submitting || !form.sealNo.trim()
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-deep-blue hover:bg-deep-blue/90'
              )}
            >
              {submitting ? '提交中...' : '提交登记'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
