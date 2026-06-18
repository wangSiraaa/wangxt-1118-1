import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, ChevronRight } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { Sample, TestConclusion } from '@/types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const statusColorMap: Record<string, string> = {
  '在库': 'bg-slate-400',
  '待检测': 'bg-green-500',
  '检测中': 'bg-green-500',
}

export default function Testing() {
  const { samples, fetchSamples, submitTestResult, currentUser } = useStore()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Sample | null>(null)
  const [testForm, setTestForm] = useState({
    conclusion: '合格' as TestConclusion,
    testDate: format(new Date(), 'yyyy-MM-dd'),
    tester: '',
    reportFile: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchSamples()
  }, [fetchSamples])

  const pendingSamples = samples.filter(
    (s) => s.status === '在库' || s.status === '待检测' || s.status === '检测中'
  )

  useEffect(() => {
    if (!selected && pendingSamples.length > 0) {
      setSelected(pendingSamples[0])
    }
  }, [pendingSamples, selected])

  useEffect(() => {
    setTestForm((f) => ({ ...f, tester: currentUser.name }))
  }, [currentUser.name])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true)
    setSuccess(false)
    try {
      await submitTestResult(selected.id, testForm)
      setSuccess(true)
      setSelected(null)
      setTestForm({
        conclusion: '合格',
        testDate: format(new Date(), 'yyyy-MM-dd'),
        tester: currentUser.name,
        reportFile: '',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      <div className="w-1/2 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">待检测样品</h2>
          <span className="text-xs text-slate-400">共 {pendingSamples.length} 条</span>
        </div>
        <div className="flex-1 overflow-auto">
          {pendingSamples.length === 0 ? (
            <div className="py-16 text-center text-slate-400">暂无待检测样品</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {pendingSamples.map((sample) => (
                <div
                  key={sample.id}
                  onClick={() => {
                    setSelected(sample)
                    setSuccess(false)
                  }}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors',
                    selected?.id === sample.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                  )}
                >
                  <div className={cn('w-1 h-9 rounded-full', statusColorMap[sample.status] || 'bg-slate-300')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-800">{sample.sampleCode}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600">
                        {sample.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {sample.itemName} · {sample.source}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-1/2 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">检测录入</h2>
        </div>
        {selected ? (
          <div className="flex-1 overflow-auto p-5">
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                检测结果提交成功
              </div>
            )}
            <div className="bg-slate-50 rounded-lg p-4 mb-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">样品编号：</span>{selected.sampleCode}</div>
                <div><span className="text-slate-500">样品名称：</span>{selected.itemName}</div>
                <div><span className="text-slate-500">扣样来源：</span>{selected.source}</div>
                <div><span className="text-slate-500">封签号：</span>{selected.sealNo}</div>
                <div><span className="text-slate-500">案件编号：</span>{selected.caseNo}</div>
                <div><span className="text-slate-500">留置截止：</span>{selected.retentionEnd}</div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  检测结论 <span className="text-red-500">*</span>
                </label>
                <select
                  value={testForm.conclusion}
                  onChange={(e) => setTestForm({ ...testForm, conclusion: e.target.value as TestConclusion })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                >
                  <option value="合格">合格</option>
                  <option value="不合格">不合格</option>
                  <option value="需复检">需复检</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">检测日期</label>
                <input
                  type="date"
                  value={testForm.testDate}
                  onChange={(e) => setTestForm({ ...testForm, testDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">检测人</label>
                <input
                  type="text"
                  value={testForm.tester}
                  onChange={(e) => setTestForm({ ...testForm, tester: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">报告文件名</label>
                <input
                  type="text"
                  value={testForm.reportFile}
                  onChange={(e) => setTestForm({ ...testForm, reportFile: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                  placeholder="输入检测报告文件名"
                />
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    'px-6 py-2 rounded-lg text-sm text-white font-medium',
                    submitting
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-deep-blue hover:bg-deep-blue/90'
                  )}
                >
                  {submitting ? '提交中...' : '提交检测结果'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <FlaskConical size={40} className="mx-auto mb-3 text-slate-300" />
              <p>请从左侧选择一个样品</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
