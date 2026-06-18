import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, Package, FlaskConical, AlertTriangle, Clock } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const statCards = [
  { key: '待入库', label: '待入库', icon: Inbox, color: 'bg-blue-500', textColor: 'text-blue-500' },
  { key: '在库', label: '在库', icon: Package, color: 'bg-slate-400', textColor: 'text-slate-500' },
  { key: '待检测', label: '待检测', icon: FlaskConical, color: 'bg-green-500', textColor: 'text-green-500' },
  { key: '待处置', label: '待处置', icon: AlertTriangle, color: 'bg-amber-500', textColor: 'text-amber-600' },
  { key: '超期', label: '超期未处理', icon: Clock, color: 'bg-red-500', textColor: 'text-red-500' },
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

export default function Dashboard() {
  const { samples, fetchSamples } = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchSamples()
  }, [fetchSamples])

  const counts = statCards.reduce((acc, card) => {
    acc[card.key] = samples.filter((s) => s.status === card.key).length
    if (card.key === '待检测') {
      acc[card.key] += samples.filter((s) => s.status === '检测中').length
    }
    return acc
  }, {} as Record<string, number>)

  const recentSamples = [...samples]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div
            key={card.key}
            className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className={cn('text-3xl font-bold mt-1', card.textColor)}>
                  {counts[card.key] || 0}
                </p>
              </div>
              <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center', card.color)}>
                <card.icon size={22} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">最近登记样品</h2>
          <button
            onClick={() => navigate('/register')}
            className="text-sm text-deep-blue hover:underline"
          >
            查看全部
          </button>
        </div>
        {recentSamples.length === 0 ? (
          <div className="py-12 text-center text-slate-400">暂无样品记录</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentSamples.map((sample) => (
              <div
                key={sample.id}
                className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 cursor-pointer"
                onClick={() => navigate(`/trace/${sample.id}`)}
              >
                <div className={cn('w-1 h-10 rounded-full', statusColorMap[sample.status] || 'bg-slate-300')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 text-sm">{sample.sampleCode}</span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      sample.status === '超期' ? 'bg-red-50 text-red-600' :
                      sample.status === '待处置' ? 'bg-amber-50 text-amber-600' :
                      sample.status === '待检测' || sample.status === '检测中' ? 'bg-green-50 text-green-600' :
                      'bg-slate-50 text-slate-600'
                    )}>
                      {sample.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {sample.itemName} · {sample.source} · {sample.caseNo}
                  </p>
                </div>
                <div className="text-xs text-slate-400">
                  {format(new Date(sample.createdAt), 'MM-dd HH:mm')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
