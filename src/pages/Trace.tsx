import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Package,
  FlaskConical,
  Trash2,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { SampleStatus } from '@/types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const flowSteps: { key: string; label: string; icon: typeof ClipboardList; statuses: SampleStatus[] }[] = [
  { key: 'register', label: '收样', icon: ClipboardList, statuses: ['待入库'] },
  { key: 'warehouse', label: '入库', icon: Package, statuses: ['在库'] },
  { key: 'testing', label: '检测', icon: FlaskConical, statuses: ['待检测', '检测中', '已检测'] },
  { key: 'disposal', label: '处置', icon: Trash2, statuses: ['待处置', '处置中', '已处置'] },
]

const statusColorMap: Record<string, string> = {
  '待入库': 'bg-blue-500',
  '在库': 'bg-slate-400',
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
}

function getStepIndex(status: SampleStatus): number {
  for (let i = 0; i < flowSteps.length; i++) {
    if (flowSteps[i].statuses.includes(status)) return i
  }
  if (status === '超期') return 2
  return -1
}

export default function Trace() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentSample, flowTraces, fetchSampleById, fetchTraces } = useStore()

  useEffect(() => {
    if (id) {
      fetchSampleById(id)
      fetchTraces(id)
    }
  }, [id, fetchSampleById, fetchTraces])

  if (!currentSample) {
    return (
      <div className="py-16 text-center text-slate-400">加载中...</div>
    )
  }

  const currentStep = getStepIndex(currentSample.status)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-5">流转状态</h2>
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
                <span className="text-slate-500">状态</span>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  currentSample.status === '超期' ? 'bg-red-50 text-red-600' :
                  currentSample.status === '待处置' ? 'bg-amber-50 text-amber-600' :
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

        <div className="w-2/3">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-5">流转记录</h3>
            {flowTraces.length === 0 ? (
              <div className="py-8 text-center text-slate-400">暂无流转记录</div>
            ) : (
              <div className="relative pl-8">
                <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-200" />
                <div className="space-y-6">
                  {flowTraces.map((trace, i) => {
                    const isLast = i === flowTraces.length - 1
                    const isCurrent = isLast && currentSample.status !== '已处置'
                    const TraceIcon = traceIconMap[trace.action] || CheckCircle2
                    return (
                      <div key={trace.id} className="relative">
                        <div className={cn(
                          'absolute -left-5 w-7 h-7 rounded-full flex items-center justify-center',
                          isCurrent ? 'bg-deep-blue text-white shadow-lg shadow-deep-blue/30' : 'bg-slate-200 text-slate-500'
                        )}>
                          <TraceIcon size={14} />
                        </div>
                        {isCurrent && (
                          <div className="absolute -left-5 w-7 h-7 rounded-full animate-ping bg-deep-blue/30" />
                        )}
                        <div className="ml-6">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-800">{trace.action}</span>
                            {isCurrent && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-deep-blue/10 text-deep-blue">当前</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>{trace.operator}（{trace.operatorRole}）</span>
                            <span>{trace.createdAt ? format(new Date(trace.createdAt), 'yyyy-MM-dd HH:mm') : ''}</span>
                          </div>
                          {trace.comment && (
                            <p className="mt-1 text-xs text-slate-500 bg-slate-50 rounded px-2 py-1">
                              {trace.comment}
                            </p>
                          )}
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
