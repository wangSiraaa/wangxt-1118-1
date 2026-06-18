import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import type { ReminderStatus } from '@/types'
import { cn } from '@/lib/utils'

const statusFlow: ReminderStatus[] = ['待催办', '已催办', '处理中', '已完结']
const nextStatus = (current: ReminderStatus): ReminderStatus | null => {
  const idx = statusFlow.indexOf(current)
  return idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null
}

const statusColor: Record<ReminderStatus, string> = {
  '待催办': 'bg-red-50 text-red-600 border-red-200',
  '已催办': 'bg-amber-50 text-amber-600 border-amber-200',
  '处理中': 'bg-blue-50 text-blue-600 border-blue-200',
  '已完结': 'bg-green-50 text-green-600 border-green-200',
}

export default function Reminder() {
  const { reminders, samples, fetchReminders, fetchSamples, updateReminder } = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchReminders()
    fetchSamples()
  }, [fetchReminders, fetchSamples])

  const sortedReminders = [...reminders].sort((a, b) => b.overdueDays - a.overdueDays)

  const handleNextStatus = async (id: string, current: ReminderStatus) => {
    const next = nextStatus(current)
    if (next) {
      await updateReminder(id, next)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">催办清单</h2>
        <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-600 font-medium">
          {reminders.filter((r) => r.status !== '已完结').length} 条超期
        </span>
      </div>
      {sortedReminders.length === 0 ? (
        <div className="py-16 text-center text-slate-400">暂无超期样品</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-5 py-3 text-left font-medium">样品编号</th>
                <th className="px-5 py-3 text-left font-medium">样品名称</th>
                <th className="px-5 py-3 text-left font-medium">留置到期日</th>
                <th className="px-5 py-3 text-left font-medium">超期天数</th>
                <th className="px-5 py-3 text-left font-medium">催办状态</th>
                <th className="px-5 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedReminders.map((reminder) => {
                const sample = samples.find((s) => s.id === reminder.sampleId)
                return (
                  <tr
                    key={reminder.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => reminder.sampleId && navigate(`/trace/${reminder.sampleId}`)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 rounded-full bg-red-500" />
                        <span className="font-medium">{sample?.sampleCode || reminder.sampleId}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">{sample?.itemName || '-'}</td>
                    <td className="px-5 py-3 text-slate-500">{sample?.retentionEnd || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        'font-bold',
                        reminder.overdueDays > 30 ? 'text-red-600' :
                        reminder.overdueDays > 14 ? 'text-amber-600' :
                        'text-slate-600'
                      )}>
                        {reminder.overdueDays} 天
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full border', statusColor[reminder.status])}>
                        {reminder.status}
                      </span>
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      {reminder.status !== '已完结' && (
                        <button
                          onClick={() => handleNextStatus(reminder.id, reminder.status)}
                          className="text-xs bg-deep-blue text-white px-3 py-1 rounded hover:bg-deep-blue/90"
                        >
                          标记为{nextStatus(reminder.status)}
                        </button>
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
  )
}
