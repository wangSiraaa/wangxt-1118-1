import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { Sample, TestConclusion, RecheckConclusion, TestResult } from '@/types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

type TabType = 'pending' | 'recheck'

interface PendingRecheckItem {
  sample: Sample
  testResult: TestResult
}

const statusColorMap: Record<string, string> = {
  '在库': 'bg-slate-400',
  '待检测': 'bg-green-500',
  '检测中': 'bg-green-500',
}

export default function Testing() {
  const {
    samples,
    fetchSamples,
    submitTestResult,
    currentUser,
    pendingRecheckSamples,
    fetchPendingRecheck,
    submitRecheckResult,
  } = useStore()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [selected, setSelected] = useState<Sample | null>(null)
  const [selectedRecheck, setSelectedRecheck] = useState<PendingRecheckItem | null>(null)

  const [testForm, setTestForm] = useState({
    conclusion: '合格' as TestConclusion,
    testDate: format(new Date(), 'yyyy-MM-dd'),
    tester: '',
    reportFile: '',
  })
  const [testSubmitting, setTestSubmitting] = useState(false)
  const [testSuccess, setTestSuccess] = useState(false)

  const [recheckForm, setRecheckForm] = useState({
    recheckConclusion: '复检合格' as RecheckConclusion,
    recheckDate: format(new Date(), 'yyyy-MM-dd'),
    recheckTester: '',
    recheckReportFile: '',
  })
  const [recheckSubmitting, setRecheckSubmitting] = useState(false)
  const [recheckSuccess, setRecheckSuccess] = useState(false)

  useEffect(() => {
    fetchSamples()
    fetchPendingRecheck()
  }, [fetchSamples, fetchPendingRecheck])

  const pendingSamples = useMemo(
    () =>
      samples.filter(
        (s) => s.status === '在库' || s.status === '待检测' || s.status === '检测中'
      ),
    [samples]
  )

  const pendingRecheckList = useMemo<PendingRecheckItem[]>(() => {
    if (!pendingRecheckSamples) return []
    const { samples: rSamples, testResults } = pendingRecheckSamples
    const result: PendingRecheckItem[] = []
    for (const tr of testResults || []) {
      if (
        tr.conclusion === '需复检' &&
        (!tr.recheckConclusion || tr.recheckConclusion === '待补录')
      ) {
        const sample = (rSamples || []).find((s) => s.id === tr.sampleId)
        if (sample) {
          result.push({ sample, testResult: tr })
        }
      }
    }
    return result
  }, [pendingRecheckSamples])

  useEffect(() => {
    if (activeTab === 'pending') {
      if (!selected && pendingSamples.length > 0) {
        setSelected(pendingSamples[0])
      }
    } else {
      if (!selectedRecheck && pendingRecheckList.length > 0) {
        setSelectedRecheck(pendingRecheckList[0])
      }
    }
  }, [activeTab, pendingSamples, pendingRecheckList, selected, selectedRecheck])

  useEffect(() => {
    setTestForm((f) => ({ ...f, tester: currentUser.name }))
    setRecheckForm((f) => ({ ...f, recheckTester: currentUser.name }))
  }, [currentUser.name])

  useEffect(() => {
    setTestForm({
      conclusion: '合格',
      testDate: format(new Date(), 'yyyy-MM-dd'),
      tester: currentUser.name,
      reportFile: '',
    })
    setTestSuccess(false)
  }, [selected, currentUser.name])

  useEffect(() => {
    setRecheckForm({
      recheckConclusion: '复检合格',
      recheckDate: format(new Date(), 'yyyy-MM-dd'),
      recheckTester: currentUser.name,
      recheckReportFile: '',
    })
    setRecheckSuccess(false)
  }, [selectedRecheck, currentUser.name])

  const handleSubmitTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setTestSubmitting(true)
    setTestSuccess(false)
    try {
      await submitTestResult(selected.id, testForm)
      setTestSuccess(true)
      setSelected(null)
      setTestForm({
        conclusion: '合格',
        testDate: format(new Date(), 'yyyy-MM-dd'),
        tester: currentUser.name,
        reportFile: '',
      })
    } finally {
      setTestSubmitting(false)
    }
  }

  const handleSubmitRecheck = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRecheck) return
    setRecheckSubmitting(true)
    setRecheckSuccess(false)
    try {
      await submitRecheckResult(selectedRecheck.sample.id, {
        testResultId: selectedRecheck.testResult.id,
        ...recheckForm,
      })
      setRecheckSuccess(true)
      setSelectedRecheck(null)
      setRecheckForm({
        recheckConclusion: '复检合格',
        recheckDate: format(new Date(), 'yyyy-MM-dd'),
        recheckTester: currentUser.name,
        recheckReportFile: '',
      })
    } finally {
      setRecheckSubmitting(false)
    }
  }

  const recheckClosed = (tr: TestResult) =>
    !!(
      tr.recheckConclusion &&
      tr.recheckConclusion !== '待补录' &&
      tr.recheckConclusion !== ''
    )

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-sm font-medium border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            待检测 {pendingSamples.length} 个
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-sm font-medium border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            待复检补录 {pendingRecheckList.length} 个
          </span>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="w-1/2 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('pending')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'pending'
                  ? 'bg-deep-blue text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              待检测样品
            </button>
            <button
              onClick={() => setActiveTab('recheck')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'recheck'
                  ? 'bg-deep-blue text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              待复检样品
            </button>
            <div className="flex-1" />
            <span className="text-xs text-slate-400">
              共 {activeTab === 'pending' ? pendingSamples.length : pendingRecheckList.length} 条
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            {activeTab === 'pending' ? (
              pendingSamples.length === 0 ? (
                <div className="py-16 text-center text-slate-400">暂无待检测样品</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {pendingSamples.map((sample) => (
                    <div
                      key={sample.id}
                      onClick={() => {
                        setSelected(sample)
                        setTestSuccess(false)
                      }}
                      className={cn(
                        'flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors',
                        selected?.id === sample.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <div
                        className={cn(
                          'w-1 h-10 rounded-full mt-1 flex-shrink-0',
                          statusColorMap[sample.status] || 'bg-slate-300'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-slate-800">
                            {sample.sampleCode}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600">
                            {sample.status}
                          </span>
                          {sample.freezeStatus === '已冻结' && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                              已冻结
                            </span>
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5">
                          <p className="text-xs text-slate-700 truncate">
                            {sample.itemName} · {sample.source}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            封签号：{sample.sealNo}
                            {sample.caseNo && <span className="mx-2">|</span>}
                            {sample.caseNo && `案件编号：${sample.caseNo}`}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 mt-1 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )
            ) : pendingRecheckList.length === 0 ? (
              <div className="py-16 text-center text-slate-400">暂无待复检样品</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {pendingRecheckList.map((item) => (
                  <div
                    key={item.testResult.id}
                    onClick={() => {
                      setSelectedRecheck(item)
                      setRecheckSuccess(false)
                    }}
                    className={cn(
                      'flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors',
                      selectedRecheck?.testResult.id === item.testResult.id
                        ? 'bg-blue-50'
                        : 'hover:bg-slate-50'
                    )}
                  >
                    <div className="w-1 h-10 rounded-full mt-1 bg-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-800">
                          {item.sample.sampleCode}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          待补录复检
                        </span>
                        {recheckClosed(item.testResult) ? (
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle2 size={12} />
                            已闭环
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                            未闭环
                          </span>
                        )}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-slate-700 truncate">{item.sample.itemName}</p>
                        <p className="text-xs text-slate-500">
                          原检测结论：
                          <span className="text-amber-600 font-medium">需复检</span>
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 mt-1 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-1/2 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col min-h-0">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">
              {activeTab === 'pending' ? '检测录入' : '复检补录'}
            </h2>
          </div>

          {activeTab === 'pending' ? (
            selected ? (
              <div className="flex-1 overflow-auto p-5">
                {testSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    检测结果提交成功
                  </div>
                )}
                <div className="bg-slate-50 rounded-lg p-4 mb-5">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">样品编号：</span>
                      {selected.sampleCode}
                    </div>
                    <div>
                      <span className="text-slate-500">样品名称：</span>
                      {selected.itemName}
                    </div>
                    <div>
                      <span className="text-slate-500">扣样来源：</span>
                      {selected.source}
                    </div>
                    <div>
                      <span className="text-slate-500">封签号：</span>
                      {selected.sealNo}
                    </div>
                    <div>
                      <span className="text-slate-500">案件编号：</span>
                      {selected.caseNo}
                    </div>
                    <div>
                      <span className="text-slate-500">留置截止：</span>
                      {selected.retentionEnd}
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmitTest} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      检测结论 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={testForm.conclusion}
                      onChange={(e) =>
                        setTestForm({ ...testForm, conclusion: e.target.value as TestConclusion })
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                    >
                      <option value="合格">合格</option>
                      <option value="不合格">不合格</option>
                      <option value="需复检">需复检</option>
                    </select>
                    {testForm.conclusion === '需复检' && (
                      <div className="mt-2 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                        <span>需复检样品将被标记为复核未闭环，待补录复检结论</span>
                      </div>
                    )}
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
                      disabled={testSubmitting}
                      className={cn(
                        'px-6 py-2 rounded-lg text-sm text-white font-medium',
                        testSubmitting
                          ? 'bg-slate-300 cursor-not-allowed'
                          : 'bg-deep-blue hover:bg-deep-blue/90'
                      )}
                    >
                      {testSubmitting ? '提交中...' : '提交检测结果'}
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
            )
          ) : selectedRecheck ? (
            <div className="flex-1 overflow-auto p-5">
              {recheckSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  复检结果提交成功
                </div>
              )}

              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-medium text-slate-700">复核闭环状态</div>
                {recheckClosed(selectedRecheck.testResult) ? (
                  <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                    <CheckCircle2 size={14} />
                    已闭环
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
                    未闭环
                  </span>
                )}
              </div>

              <div className="bg-slate-50 rounded-lg p-4 mb-5">
                <div className="text-xs font-medium text-slate-500 mb-3">原检测信息</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">样品编号：</span>
                    {selectedRecheck.sample.sampleCode}
                  </div>
                  <div>
                    <span className="text-slate-500">样品名称：</span>
                    {selectedRecheck.sample.itemName}
                  </div>
                  <div>
                    <span className="text-slate-500">原检测结论：</span>
                    <span className="text-amber-600 font-medium">需复检</span>
                  </div>
                  <div>
                    <span className="text-slate-500">原检测人：</span>
                    {selectedRecheck.testResult.tester || '-'}
                  </div>
                  <div>
                    <span className="text-slate-500">原检测日期：</span>
                    {selectedRecheck.testResult.testDate || '-'}
                  </div>
                  <div>
                    <span className="text-slate-500">封签号：</span>
                    {selectedRecheck.sample.sealNo}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmitRecheck} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    复检结论 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={recheckForm.recheckConclusion}
                    onChange={(e) =>
                      setRecheckForm({
                        ...recheckForm,
                        recheckConclusion: e.target.value as RecheckConclusion,
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                  >
                    <option value="复检合格">复检合格</option>
                    <option value="复检不合格">复检不合格</option>
                    <option value="无需复检">无需复检</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">复检日期</label>
                  <input
                    type="date"
                    value={recheckForm.recheckDate}
                    onChange={(e) =>
                      setRecheckForm({ ...recheckForm, recheckDate: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">复检人</label>
                  <input
                    type="text"
                    value={recheckForm.recheckTester}
                    onChange={(e) =>
                      setRecheckForm({ ...recheckForm, recheckTester: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    复检报告文件名
                  </label>
                  <input
                    type="text"
                    value={recheckForm.recheckReportFile}
                    onChange={(e) =>
                      setRecheckForm({ ...recheckForm, recheckReportFile: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                    placeholder="输入复检报告文件名（可选）"
                  />
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={recheckSubmitting}
                    className={cn(
                      'px-6 py-2 rounded-lg text-sm text-white font-medium',
                      recheckSubmitting
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-deep-blue hover:bg-deep-blue/90'
                    )}
                  >
                    {recheckSubmitting ? '提交中...' : '提交复检结果'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <FlaskConical size={40} className="mx-auto mb-3 text-slate-300" />
                <p>请从左侧选择一个待复检样品</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
