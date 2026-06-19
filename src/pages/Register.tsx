import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Plus, Trash2, ChevronDown, ChevronUp, Star, Search } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { SampleSource } from '@/types'
import { cn } from '@/lib/utils'
import { format, addDays, differenceInDays, parseISO } from 'date-fns'

interface RelatedCaseItem {
  caseNo: string
  caseName?: string
  isPrimary: boolean
}

interface CaseSuggestion {
  caseNo: string
  caseName: string
}

const SEAL_VERSION = 1

export default function Register() {
  const { createSample, currentUser, searchCases, cases } = useStore()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    source: '执法扣留' as SampleSource,
    caseNo: '',
    sealNo: '',
    itemName: '',
    quantity: 1,
    spec: '',
    retentionDays: 90,
    retentionStart: format(new Date(), 'yyyy-MM-dd'),
    retentionEnd: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
    isInvolved: false,
    disposalDocNo: '',
  })
  const [relatedCases, setRelatedCases] = useState<RelatedCaseItem[]>([])
  const [caseInput, setCaseInput] = useState({ caseNo: '', caseName: '', isPrimary: false })
  const [caseSuggestions, setCaseSuggestions] = useState<CaseSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1)
  const [sealNoValid, setSealNoValid] = useState<boolean | null>(null)
  const [showSealTip, setShowSealTip] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const caseInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (form.sealNo.trim()) {
      setSealNoValid(true)
    } else {
      setSealNoValid(false)
    }
  }, [form.sealNo])

  useEffect(() => {
    try {
      const start = parseISO(form.retentionStart)
      const end = parseISO(form.retentionEnd)
      if (start.getTime() > end.getTime()) {
        setForm((f) => ({
          ...f,
          retentionEnd: format(addDays(start, f.retentionDays), 'yyyy-MM-dd'),
        }))
      }
    } catch {
      // ignore invalid date
    }
  }, [form.retentionStart])

  const recalcEndDate = (start: string, days: number) => {
    try {
      const s = parseISO(start)
      return format(addDays(s, days), 'yyyy-MM-dd')
    } catch {
      return form.retentionEnd
    }
  }

  const recalcDaysFromEnd = (start: string, end: string) => {
    try {
      const s = parseISO(start)
      const e = parseISO(end)
      const diff = differenceInDays(e, s)
      return diff > 0 ? diff : 1
    } catch {
      return form.retentionDays
    }
  }

  const handleRetentionStartChange = (value: string) => {
    const newEnd = recalcEndDate(value, form.retentionDays)
    setForm((f) => ({ ...f, retentionStart: value, retentionEnd: newEnd }))
  }

  const handleRetentionDaysChange = (value: number) => {
    const days = value > 0 ? value : 1
    const newEnd = recalcEndDate(form.retentionStart, days)
    setForm((f) => ({ ...f, retentionDays: days, retentionEnd: newEnd }))
  }

  const handleRetentionEndChange = (value: string) => {
    const days = recalcDaysFromEnd(form.retentionStart, value)
    setForm((f) => ({ ...f, retentionEnd: value, retentionDays: days }))
  }

  const triggerCaseSearch = (keyword: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!keyword.trim()) {
      setCaseSuggestions([])
      setShowSuggestions(false)
      return
    }
    searchTimeoutRef.current = setTimeout(async () => {
      await searchCases(keyword.trim())
    }, 300)
  }

  useEffect(() => {
    if (cases && cases.length > 0) {
      setCaseSuggestions(
        cases.map((c) => ({ caseNo: c.caseNo, caseName: c.caseName }))
      )
      setShowSuggestions(true)
      setActiveSuggestionIdx(-1)
    }
  }, [cases])

  const handleAddCase = () => {
    const caseNo = caseInput.caseNo.trim()
    if (!caseNo) {
      return
    }
    const exists = relatedCases.some((c) => c.caseNo === caseNo)
    if (exists) {
      setError(`案件编号 ${caseNo} 已添加`)
      return
    }
    const isPrimary =
      caseInput.isPrimary || relatedCases.length === 0
    const next: RelatedCaseItem[] = relatedCases.map((c) =>
      isPrimary ? { ...c, isPrimary: false } : c
    )
    next.push({
      caseNo,
      caseName: caseInput.caseName.trim() || undefined,
      isPrimary,
    })
    setRelatedCases(next)
    setCaseInput({ caseNo: '', caseName: '', isPrimary: false })
    setCaseSuggestions([])
    setShowSuggestions(false)
    setError(null)
  }

  const handleRemoveCase = (idx: number) => {
    const removed = relatedCases[idx]
    const next = relatedCases.filter((_, i) => i !== idx)
    if (removed.isPrimary && next.length > 0) {
      next[0] = { ...next[0], isPrimary: true }
    }
    setRelatedCases(next)
  }

  const handleSetPrimaryCase = (idx: number) => {
    const next = relatedCases.map((c, i) => ({
      ...c,
      isPrimary: i === idx,
    }))
    setRelatedCases(next)
  }

  const handleSuggestionPick = (s: CaseSuggestion) => {
    setCaseInput({ ...caseInput, caseNo: s.caseNo, caseName: s.caseName })
    setCaseSuggestions([])
    setShowSuggestions(false)
  }

  const handleCaseInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || caseSuggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddCase()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestionIdx((i) =>
        i < caseSuggestions.length - 1 ? i + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestionIdx((i) =>
        i > 0 ? i - 1 : caseSuggestions.length - 1
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeSuggestionIdx >= 0 && caseSuggestions[activeSuggestionIdx]) {
        handleSuggestionPick(caseSuggestions[activeSuggestionIdx])
      } else {
        handleAddCase()
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        caseInputRef.current &&
        !caseInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.sealNo.trim()) {
      setError('封签号不能为空，请填写封签号后方可提交')
      return
    }
    if (relatedCases.length === 0) {
      setError('请至少添加一个关联案件')
      return
    }
    const hasPrimary = relatedCases.some((c) => c.isPrimary)
    if (!hasPrimary) {
      setError('关联案件中至少需要一个主案件')
      return
    }
    for (const c of relatedCases) {
      if (!c.caseNo.trim()) {
        setError('关联案件中的案件编号不能为空')
        return
      }
    }
    if (form.isInvolved && !form.disposalDocNo.trim()) {
      setError('涉案样品必须填写处置批文号')
      return
    }
    if (!form.itemName.trim()) {
      setError('样品名称不能为空')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const result = await createSample({
        source: form.source,
        caseNo: relatedCases.find((c) => c.isPrimary)?.caseNo || form.caseNo,
        sealNo: form.sealNo,
        sealVersion: SEAL_VERSION,
        itemName: form.itemName,
        quantity: form.quantity,
        spec: form.spec,
        retentionDays: form.retentionDays,
        retentionStart: form.retentionStart,
        retentionEnd: form.retentionEnd,
        isInvolved: form.isInvolved,
        disposalDocNo: form.disposalDocNo,
        createdBy: currentUser.name,
        relatedCases: relatedCases.map((c) => ({
          caseNo: c.caseNo,
          caseName: c.caseName,
          isPrimary: c.isPrimary,
        })),
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
          retentionStart: format(new Date(), 'yyyy-MM-dd'),
          retentionEnd: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
          isInvolved: false,
          disposalDocNo: '',
        })
        setRelatedCases([])
        setSealNoValid(null)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-lg">收样登记</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            录入扣样来源、封签号及样品基本信息
          </p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 bg-deep-blue rounded" />
              <h3 className="font-medium text-slate-800 text-sm">
                关联案件
                <span className="text-red-500 ml-1">*</span>
              </h3>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 w-10"></th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">
                        案件编号
                        <span className="text-red-500 ml-0.5">*</span>
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">
                        案件名称
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-slate-600 w-32">
                        主案件
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-slate-600 w-20">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {relatedCases.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-400 text-sm">
                          暂未添加案件，请在下方输入后点击添加
                        </td>
                      </tr>
                    )}
                    {relatedCases.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2">
                          {c.isPrimary && (
                            <Star
                              size={14}
                              className="text-amber-500 fill-amber-500"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-800">
                          {c.caseNo}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {c.caseName || <span className="text-slate-400">-</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name={`primary-${idx}`}
                              checked={c.isPrimary}
                              onChange={() => handleSetPrimaryCase(idx)}
                              className="w-4 h-4 text-deep-blue focus:ring-deep-blue"
                            />
                          </label>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveCase(idx)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/50 p-3 space-y-2">
                <div className="grid grid-cols-[1fr,1fr,auto,auto] gap-2 items-start">
                  <div ref={caseInputRef} className="relative">
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      />
                      <input
                        type="text"
                        value={caseInput.caseNo}
                        onChange={(e) => {
                          setCaseInput({
                            ...caseInput,
                            caseNo: e.target.value,
                          })
                          triggerCaseSearch(e.target.value)
                        }}
                        onFocus={() => {
                          if (caseSuggestions.length > 0) setShowSuggestions(true)
                        }}
                        onKeyDown={handleCaseInputKeyDown}
                        className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                        placeholder="输入案件编号搜索..."
                      />
                    </div>
                    {showSuggestions && caseSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto">
                        {caseSuggestions.map((s, i) => (
                          <div
                            key={s.caseNo}
                            onClick={() => handleSuggestionPick(s)}
                            className={cn(
                              'px-3 py-2 cursor-pointer border-b border-slate-100 last:border-b-0',
                              i === activeSuggestionIdx
                                ? 'bg-deep-blue/5'
                                : 'hover:bg-slate-50'
                            )}
                          >
                            <div className="text-sm font-mono text-slate-800">
                              {s.caseNo}
                            </div>
                            {s.caseName && (
                              <div className="text-xs text-slate-500 mt-0.5">
                                {s.caseName}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={caseInput.caseName}
                    onChange={(e) =>
                      setCaseInput({
                        ...caseInput,
                        caseName: e.target.value,
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                    placeholder="案件名称（可选）"
                  />
                  <label className="flex items-center gap-1.5 px-3 py-2 h-full border border-slate-300 rounded-lg bg-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={caseInput.isPrimary}
                      onChange={(e) =>
                        setCaseInput({
                          ...caseInput,
                          isPrimary: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-deep-blue focus:ring-deep-blue"
                    />
                    <span className="text-sm text-slate-700 whitespace-nowrap">
                      设为主案件
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddCase}
                    disabled={!caseInput.caseNo.trim()}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition',
                      caseInput.caseNo.trim()
                        ? 'bg-deep-blue text-white hover:bg-deep-blue/90'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    )}
                  >
                    <Plus size={16} />
                    添加
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  提示：新添加的第一个案件会自动设为主案件，主案件将
                  <Star size={11} className="inline text-amber-500 fill-amber-500 mx-0.5" />
                  标记显示
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                扣样来源 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.source}
                onChange={(e) =>
                  setForm({ ...form, source: e.target.value as SampleSource })
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
              >
                <option value="执法扣留">执法扣留</option>
                <option value="检验抽样">检验抽样</option>
                <option value="抽查取样">抽查取样</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                封签号 <span className="text-red-500">*</span>
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                  V{SEAL_VERSION}
                </span>
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
                  <CheckCircle2
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
                    size={20}
                  />
                )}
                {sealNoValid === false && form.sealNo !== '' && (
                  <AlertCircle
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 animate-[shake_0.3s_ease-in-out]"
                    size={20}
                  />
                )}
              </div>
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => setShowSealTip((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition"
                >
                  {showSealTip ? (
                    <ChevronUp size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                  封签号变更将自动升级版本并保留历史记录
                </button>
                {showSealTip && (
                  <div className="mt-1.5 p-2 bg-amber-50 border border-amber-100 rounded text-xs text-amber-700 leading-relaxed">
                    当前为 V{SEAL_VERSION} 版本。若后续修改封签号，系统将自动递增版本号（V2、V3...），
                    并在封签版本历史中保留每次变更记录，包含变更原因、变更人及变更时间。
                  </div>
                )}
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 bg-deep-blue rounded" />
              <h3 className="font-medium text-slate-800 text-sm">样品基础信息</h3>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  数量
                </label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      quantity: Number(e.target.value) || 1,
                    })
                  }
                  min={1}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  规格
                </label>
                <input
                  type="text"
                  value={form.spec}
                  onChange={(e) => setForm({ ...form, spec: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 bg-deep-blue rounded" />
              <h3 className="font-medium text-slate-800 text-sm">留置期</h3>
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  留置起始日期
                </label>
                <input
                  type="date"
                  value={form.retentionStart}
                  onChange={(e) => handleRetentionStartChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  留置天数
                </label>
                <input
                  type="number"
                  value={form.retentionDays}
                  onChange={(e) =>
                    handleRetentionDaysChange(Number(e.target.value) || 1)
                  }
                  min={1}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  留置截止日期
                </label>
                <input
                  type="date"
                  value={form.retentionEnd}
                  onChange={(e) => handleRetentionEndChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                />
              </div>
            </div>
          </section>

          <div className="flex items-start gap-8 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isInvolved}
                onChange={(e) =>
                  setForm({ ...form, isInvolved: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-300 text-deep-blue focus:ring-deep-blue"
              />
              <span className="text-sm text-slate-700">是否涉案</span>
            </label>
            {form.isInvolved && (
              <div className="flex-1 space-y-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    处置批文号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.disposalDocNo}
                    onChange={(e) =>
                      setForm({ ...form, disposalDocNo: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-blue/30 focus:border-deep-blue"
                    placeholder="涉案样品必填"
                  />
                </div>
                <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2 text-xs text-amber-700 leading-relaxed">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    涉案样品处置时必须提供处置批文，否则催办清单将标记为
                    <span className="font-semibold mx-1">【待批文】</span>
                    ，请务必在处置前完成批文上传。
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-2">
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
