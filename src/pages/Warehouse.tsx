import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'
import { format, differenceInDays, parseISO } from 'date-fns'

export default function Warehouse() {
  const { warehouses, samples, fetchWarehouses, fetchSamples, allocateWarehouse, confirmIn, currentUser } = useStore()
  const navigate = useNavigate()
  const [allocating, setAllocating] = useState<string | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    fetchWarehouses()
    fetchSamples()
  }, [fetchWarehouses, fetchSamples])

  const pendingSamples = samples.filter((s) => s.status === '待入库')
  const inStockSamples = samples.filter((s) => s.status === '在库' || s.status === '待检测')

  const slotColor = (status: string) => {
    if (status === '空闲') return 'bg-green-100 border-green-300 text-green-700'
    if (status === '占用') return 'bg-blue-100 border-blue-300 text-blue-700'
    return 'bg-amber-100 border-amber-300 text-amber-700'
  }

  const handleAllocate = async (warehouseId: string) => {
    if (!selectedSampleId) return
    setAllocating(warehouseId)
    try {
      await allocateWarehouse(warehouseId, selectedSampleId)
      setAllocating(null)
      setSelectedSampleId('')
    } catch {
      setAllocating(null)
    }
  }

  const handleConfirm = async (sampleId: string) => {
    const sample = samples.find((s) => s.id === sampleId)
    if (!sample?.sealNo?.trim()) {
      alert('封签号缺失，无法确认入库！')
      return
    }
    setConfirming(sampleId)
    try {
      await confirmIn(sampleId)
      setConfirming(null)
    } catch {
      setConfirming(null)
    }
  }

  const isNearEnd = (retentionEnd: string) => {
    return differenceInDays(parseISO(retentionEnd), new Date()) <= 7 && differenceInDays(parseISO(retentionEnd), new Date()) >= 0
  }

  const isOverdue = (retentionEnd: string) => {
    return differenceInDays(parseISO(retentionEnd), new Date()) < 0
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">库位视图</h2>
          <p className="text-xs text-slate-500 mt-0.5">点击空闲库位分配待入库样品</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-4 gap-4">
            {warehouses.map((wh) => (
              <div
                key={wh.id}
                className={cn(
                  'border-2 rounded-lg p-4 text-center transition-all cursor-pointer',
                  slotColor(wh.status),
                  allocating === wh.id && 'ring-2 ring-deep-blue ring-offset-2'
                )}
                onClick={() => {
                  if (wh.status === '空闲') {
                    setAllocating(allocating === wh.id ? null : wh.id)
                  }
                }}
              >
                <Package size={24} className="mx-auto mb-2" />
                <div className="font-bold text-sm">{wh.code}</div>
                <div className="text-xs mt-1">{wh.name}</div>
                <div className="text-xs mt-1 font-medium">{wh.status}</div>
                {allocating === wh.id && (
                  <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={selectedSampleId}
                      onChange={(e) => setSelectedSampleId(e.target.value)}
                      className="w-full text-xs border rounded px-2 py-1.5 bg-white"
                    >
                      <option value="">选择样品</option>
                      {pendingSamples.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.sampleCode} - {s.itemName}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAllocate(wh.id)}
                      disabled={!selectedSampleId}
                      className="w-full text-xs bg-deep-blue text-white rounded py-1.5 disabled:bg-slate-300"
                    >
                      分配
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">在库样品</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-5 py-3 text-left font-medium">样品编号</th>
                <th className="px-5 py-3 text-left font-medium">样品名称</th>
                <th className="px-5 py-3 text-left font-medium">库位</th>
                <th className="px-5 py-3 text-left font-medium">状态</th>
                <th className="px-5 py-3 text-left font-medium">留置截止日</th>
                <th className="px-5 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {samples.filter((s) => ['待入库', '在库', '待检测'].includes(s.status)).map((sample) => {
                const wh = warehouses.find((w) => w.id === sample.warehouseId)
                const nearEnd = sample.retentionEnd && isNearEnd(sample.retentionEnd)
                const overdue = sample.retentionEnd && isOverdue(sample.retentionEnd)
                return (
                  <tr
                    key={sample.id}
                    className={cn(
                      'hover:bg-slate-50 cursor-pointer',
                      overdue && 'bg-red-50/50',
                      nearEnd && 'bg-amber-50/50'
                    )}
                    onClick={() => navigate(`/trace/${sample.id}`)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-1 h-6 rounded-full',
                          sample.status === '待入库' ? 'bg-blue-500' : 'bg-slate-400'
                        )} />
                        {sample.sampleCode}
                      </div>
                    </td>
                    <td className="px-5 py-3">{sample.itemName}</td>
                    <td className="px-5 py-3">{wh ? wh.code : '-'}</td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        sample.status === '待入库' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'
                      )}>
                        {sample.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        {sample.retentionEnd || '-'}
                        {nearEnd && <AlertTriangle size={14} className="text-amber-500" />}
                        {overdue && <AlertTriangle size={14} className="text-red-500" />}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {sample.status === '待入库' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleConfirm(sample.id)
                          }}
                          disabled={confirming === sample.id}
                          className="text-xs bg-deep-blue text-white px-3 py-1 rounded disabled:bg-slate-300"
                        >
                          {confirming === sample.id ? '确认中...' : '确认入库'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
