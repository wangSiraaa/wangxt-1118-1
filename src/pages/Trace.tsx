import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Package,
  FlaskConical,
  Trash2,
  CheckCircle2,
  ArrowRight,
  Snowflake,
  Clock,
  Sunrise,
  GitBranch,
  Tag,
  AlertTriangle,
  UserCog,
  RefreshCw,
  Shield,
  FileText,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { SampleStatus } from '@/types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const flowSteps: { key: string; label: string; icon: typeof ClipboardList; statuses: SampleStatus[] }[] = [
  { key: 'register', label: '收样', icon: ClipboardList, statuses: ['待入库'] },
  { key: 'warehouse', label: '入库', icon: Package, statuses: ['在库'] },
  { key: 'freeze', label: '冻结', icon: Snowflake, statuses: ['已冻结'] },
  { key: 'testing', label: '检测', icon: FlaskConical, statuses: ['待检测', '检测中', '已检测'] },
  { key: 'disposal', label: '处置', icon: Trash2, statuses: ['待处置', '处置中', '已处置'] },
]

const statusColorMap: Record<string, string> = {
  '待入库': 'bg-blue-500',
  '在库': 'bg-slate-400',
  '已冻结': 'bg-sky-500',
  '待检测': 'bg-green-500',
  '检测中': 'bg-green-500',
  '已检测': 'bg-green-600',
  '待处置': 'bg-amber-500',
  '处置中': 'bg-amber-600',
  '已处置': 'bg-slate-300',
  '超期': 'bg-red-500',
}

const traceIconMap: Record<string, typeof ClipboardList> = {
  '收样登记': ClipboardList,
  '入库确认': Package,
  '分配库位': Package,
  '提交检测': FlaskConical,
  '发起处置': Trash2,
  '审批通过': CheckCircle2,
  '补录复检': RefreshCw,
  '申请延期': Clock,
  '延期审批': CheckCircle2,
  '申请冻结': Snowflake,
  '冻结审批': CheckCircle2,
  '解冻操作': Sunrise,
  '分样': GitBranch,
  '封签变更': Tag,
  '催办标记': AlertTriangle,
  '催办改派': UserCog,
}

type TraceActionCategory = 'default' | 'testing' | 'disposal' | 'freeze' | 'reminder' | 'extension'

const traceCategoryColor: Record<TraceActionCategory, string> = {
  default: 'bg-slate-200 text-slate-500',
  testing: 'bg-green-100 text-green-600',
  disposal: 'bg-amber-100 text-amber-600',
  freeze: 'bg-sky-100 text-sky-600',
  reminder: 'bg-red-100 text-red-600',
  extension: 'bg-purple-100 text-purple-600',
}

function getActionCategory(action: string): TraceActionCategory {
  if (action.includes('检测') || action.includes('复检')) return 'testing'
  if (action.includes('处置')) return 'disposal'
  if (action.includes('冻结') || action.includes('解冻')) return 'freeze'
  if (action.includes('催办')) return 'reminder'
  if (action.includes('延期')) return 'extension'
  return 'default'
}

function getStepIndex(status: SampleStatus): number {
  for (let i = 0; i < flowSteps.length; i++) {
    if (flowSteps[i].statuses.includes(status)) return i
  }
  if (status === '超期') return 3
  return -1
}

function EmptyHint({ text = '暂无记录' }: { text?: string }) {
  return (
    <div className="py-6 text-center text-sm text-slate-400">{text}</div>
  )
}

export default function Trace() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    currentSample,
    flowTraces,
    samples,
    extensions,
    freezeRecords,
    splitSamples,
    fetchSampleById,
    fetchTraces,
    fetchExtensions,
    fetchFreezeRecords,
    fetchSplitSamples,
    fetchSamples,
  } = useStore()

  useEffect(() => {
    if (id) {
      fetchSampleById(id)
      fetchTraces(id)
    }
    fetchExtensions()
    fetchFreezeRecords()
    fetchSplitSamples()
    fetchSamples()
  }, [id, fetchSampleById, fetchTraces, fetchExtensions, fetchFreezeRecords, fetchSplitSamples, fetchSamples])

  if (!currentSample) {
    return (
      <div className="py-16 text-center text-slate-400">加载中...</div>
    )
  }

  const currentStep = getStepIndex(currentSample.status)

  const relatedCases = (currentSample as any)?.relatedCases as any[] | undefined
  const sealVersions = (currentSample as any)?.sealVersions as any[] | undefined

  const sampleExtensions = extensions.filter((e) => e.sampleId === currentSample.id)
  const activeExtensions = sampleExtensions.filter((e) => e.status === '已审批')
  const hasActiveExtension = activeExtensions.length > 0

  const sampleFreezeRecords = freezeRecords.filter((f) => f.sampleId === currentSample.id)

  const childSplits = splitSamples.filter((s) => s.parentSampleId === currentSample.id)
  const parentSplit = splitSamples.find((s) => s.childSampleId === currentSample.id)
  const isParentSample = childSplits.length > 0
  const childSamples = childSplits.map((s) => samples.find((sample) => sample.id === s.childSampleId)).filter(Boolean)
  const parentSample = parentSplit ? samples.find((s) => s.id === parentSplit.parentSampleId) : undefined

  const currentSealVersion = currentSample.sealVersion ? `V${currentSample.sealVersion}` : '-'
  const reviewClosedText = currentSample.reviewClosed ? '是' : '否'

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-slate-800">流转状态</h2>
          <div className="flex items-center gap-2">
            {hasActiveExtension && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 border border-purple-200 font-medium flex items-center gap-1">
                <Clock size={12} />
                已延期
              </span>
            )}
            {currentSample.freezeStatus === '已冻结' && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-600 border border-sky-200 font-medium flex items-center gap-1">
                <Snowflake size={12} />
                已冻结
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center gap-0">
          {flowSteps.map((step, i) => {
            const isActive = i === currentStep
            const isDone = i < currentStep
            const Icon = step.icon
            return (
              <div key={step.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                    isActive ? 'bg-deep-blue text-white scale-110 shadow-lg shadow-deep-blue/30' :
                    isDone ? 'bg-green-500 text-white' :
                    'bg-slate-100 text-slate-400'
                  )}>
                    <Icon size={20} />
                  </div>
                  <span className={cn(
                    'text-xs mt-2 font-medium',
                    isActive ? 'text-deep-blue' :
                    isDone ? 'text-green-600' :
                    'text-slate-400'
                  )}>
                    {step.label}
                  </span>
                  {isActive && (
                    <span className="text-xs text-deep-blue mt-0.5 animate-pulse">当前</span>
                  )}
                </div>
                {i < flowSteps.length - 1 && (
                  <ArrowRight className={cn(
                    'mx-3 mb-5',
                    i < currentStep ? 'text-green-500' : 'text-slate-300'
                  )} size={20} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-6">
        <div className="w-1/3">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className={cn('w-1.5 h-6 rounded-full', statusColorMap[currentSample.status] || 'bg-slate-300')} />
              <h3 className="font-semibold text-slate-800">样品详情</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">样品编号</span>
                <span className="font-medium">{currentSample.sampleCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">样品名称</span>
                <span>{currentSample.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">扣样来源</span>
                <span>{currentSample.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">案件编号</span>
                <span>{currentSample.caseNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">封签号</span>
                <span className="font-mono">{currentSample.sealNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">封签版本号</span>
                <span className="font-mono">{currentSealVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">冻结状态</span>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  currentSample.freezeStatus === '已冻结' ? 'bg-sky-50 text-sky-600' :
                  currentSample.freezeStatus === '已解冻' ? 'bg-slate-100 text-slate-600' :
                  'bg-green-50 text-green-600'
                )}>
                  {currentSample.freezeStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">复核闭环</span>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  currentSample.reviewClosed ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-600'
                )}>
                  {reviewClosedText}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">状态</span>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  currentSample.status === '超期' ? 'bg-red-50 text-red-600' :
                  currentSample.status === '待处置' ? 'bg-amber-50 text-amber-600' :
                  currentSample.status === '已冻结' ? 'bg-sky-50 text-sky-600' :
                  'bg-slate-50 text-slate-600'
                )}>
                  {currentSample.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">留置期限</span>
                <span>{currentSample.retentionStart} ~ {currentSample.retentionEnd}</span>
              </div>
              {currentSample.isInvolved && (
                <div className="flex justify-between">
                  <span className="text-slate-500">涉案</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600">是</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">创建时间</span>
                <span>{currentSample.createdAt}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-2/3 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-5 rounded-full bg-indigo-500" />
              <h3 className="font-semibold text-slate-800 text-sm">关联案件</h3>
            </div>
            {!relatedCases || relatedCases.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="px-4 py-2 text-left font-medium">案件编号</th>
                      <th className="px-4 py-2 text-left font-medium">案件名称</th>
                      <th className="px-4 py-2 text-left font-medium w-24">主案件</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {relatedCases.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 font-mono text-slate-800">{item.caseNo}</td>
                        <td className="px-4 py-2 text-slate-700">{item.caseName || '-'}</td>
                        <td className="px-4 py-2">
                          {item.isPrimary ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                              主案件
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-5 rounded-full bg-cyan-500" />
              <h3 className="font-semibold text-slate-800 text-sm">封签版本历史</h3>
            </div>
            {!sealVersions || sealVersions.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="px-4 py-2 text-left font-medium w-20">版本号</th>
                      <th className="px-4 py-2 text-left font-medium">封签号</th>
                      <th className="px-4 py-2 text-left font-medium">变更原因</th>
                      <th className="px-4 py-2 text-left font-medium">变更人</th>
                      <th className="px-4 py-2 text-left font-medium">变更时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sealVersions.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-cyan-50 text-cyan-600 font-mono font-medium">
                            V{item.version}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-slate-800">{item.sealNo}</td>
                        <td className="px-4 py-2 text-slate-700">{item.changeReason || '-'}</td>
                        <td className="px-4 py-2 text-slate-700">{item.changedBy || '-'}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs">{item.changedAt || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch size={16} className="text-emerald-600" />
              <h3 className="font-semibold text-slate-800 text-sm">分样关系</h3>
            </div>
            {isParentSample ? (
              childSamples.length === 0 ? (
                <EmptyHint />
              ) : (
                <div>
                  <div className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                    <Shield size={12} />
                    当前为母样，以下为子样列表
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600">
                          <th className="px-4 py-2 text-left font-medium">样品编号</th>
                          <th className="px-4 py-2 text-left font-medium">样品名称</th>
                          <th className="px-4 py-2 text-left font-medium">数量</th>
                          <th className="px-4 py-2 text-left font-medium">分样原因</th>
                          <th className="px-4 py-2 text-left font-medium">状态</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {childSplits.map((split) => {
                          const child = samples.find((s) => s.id === split.childSampleId)
                          return (
                            <tr
                              key={split.id}
                              className="cursor-pointer hover:bg-slate-50"
                              onClick={() => child && navigate(`/trace/${child.id}`)}
                            >
                              <td className="px-4 py-2 font-medium text-deep-blue">{child?.sampleCode || split.childSampleId}</td>
                              <td className="px-4 py-2 text-slate-700">{child?.itemName || '-'}</td>
                              <td className="px-4 py-2 text-slate-700">{split.splitQuantity}</td>
                              <td className="px-4 py-2 text-slate-600 text-xs">{split.splitReason || '-'}</td>
                              <td className="px-4 py-2">
                                <span className={cn(
                                  'text-xs px-2 py-0.5 rounded-full',
                                  split.status === '已执行' ? 'bg-green-50 text-green-600' :
                                  split.status === '已审批' ? 'bg-blue-50 text-blue-600' :
                                  'bg-amber-50 text-amber-600'
                                )}>
                                  {split.status}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : parentSample ? (
              <div>
                <div className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                  <FileText size={12} />
                  当前为子样，以下为母样信息
                </div>
                <div
                  className="bg-slate-50 rounded-lg p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => navigate(`/trace/${parentSample.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-deep-blue">{parentSample.sampleCode}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">母样</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{parentSample.itemName}</p>
                    </div>
                    <ArrowRight size={16} className="text-slate-400" />
                  </div>
                  {parentSplit && (
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                      <span>分样数量：{parentSplit.splitQuantity}</span>
                      <span>分样日期：{parentSplit.splitDate}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyHint text="无分样关系" />
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-5 rounded-full bg-purple-500" />
              <h3 className="font-semibold text-slate-800 text-sm">延期记录</h3>
            </div>
            {sampleExtensions.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="px-4 py-2 text-left font-medium">原截止日</th>
                      <th className="px-4 py-2 text-left font-medium w-20">延长天数</th>
                      <th className="px-4 py-2 text-left font-medium">新截止日</th>
                      <th className="px-4 py-2 text-left font-medium w-24">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sampleExtensions.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-slate-700">{item.originalEndDate}</td>
                        <td className="px-4 py-2">
                          <span className="font-bold text-purple-600">+{item.extendedDays}天</span>
                        </td>
                        <td className="px-4 py-2 text-slate-700">{item.newEndDate}</td>
                        <td className="px-4 py-2">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            item.status === '已审批' ? 'bg-green-50 text-green-600' :
                            item.status === '已驳回' ? 'bg-red-50 text-red-600' :
                            'bg-amber-50 text-amber-600'
                          )}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-5 rounded-full bg-sky-500" />
              <h3 className="font-semibold text-slate-800 text-sm">冻结记录</h3>
            </div>
            {sampleFreezeRecords.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="px-4 py-2 text-left font-medium">类型</th>
                      <th className="px-4 py-2 text-left font-medium">文书号</th>
                      <th className="px-4 py-2 text-left font-medium">起止日期</th>
                      <th className="px-4 py-2 text-left font-medium w-24">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sampleFreezeRecords.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-sky-50 text-sky-600">
                            {item.freezeType}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-slate-800">{item.freezeOrderNo}</td>
                        <td className="px-4 py-2 text-slate-600 text-xs">
                          {item.freezeStartDate} ~ {item.freezeEndDate}
                        </td>
                        <td className="px-4 py-2">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            item.status === '已冻结' ? 'bg-sky-50 text-sky-600' :
                            'bg-slate-100 text-slate-600'
                          )}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-5">流转记录</h3>
            {flowTraces.length === 0 ? (
              <EmptyHint text="暂无流转记录" />
            ) : (
              <div className="relative pl-8">
                <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-200" />
                <div className="space-y-6">
                  {flowTraces.map((trace, i) => {
                    const isLast = i === flowTraces.length - 1
                    const isCurrent = isLast && currentSample.status !== '已处置'
                    const TraceIcon = traceIconMap[trace.action] || CheckCircle2
                    const category = getActionCategory(trace.action)
                    const categoryColors = traceCategoryColor[category]
                    return (
                      <div key={trace.id} className="relative">
                        <div className={cn(
                          'absolute -left-5 w-7 h-7 rounded-full flex items-center justify-center',
                          isCurrent
                            ? 'bg-deep-blue text-white shadow-lg shadow-deep-blue/30'
                            : categoryColors
                        )}>
                          <TraceIcon size={14} />
                        </div>
                        {isCurrent && (
                          <div className="absolute -left-5 w-7 h-7 rounded-full animate-ping bg-deep-blue/30" />
                        )}
                        <div className="ml-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm text-slate-800">{trace.action}</span>
                                {isCurrent && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-deep-blue/10 text-deep-blue">当前</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span>{trace.createdAt ? format(new Date(trace.createdAt), 'yyyy-MM-dd HH:mm') : ''}</span>
                              </div>
                              {trace.comment && (
                                <p className="mt-1 text-xs text-slate-500 bg-slate-50 rounded px-2 py-1">
                                  {trace.comment}
                                </p>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              <span className="inline-flex items-center text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                {trace.operator}<span className="mx-0.5">/</span>{trace.operatorRole}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
