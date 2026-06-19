import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  FileText,
  RefreshCw,
  MapPin,
  X,
  UserCog,
  ChevronRight,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { ReminderStatus, ReminderCategory, Reminder } from '@/types'
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

const categoryColor: Record<ReminderCategory, string> = {
  '待批文': 'bg-red-50 text-red-600 border-red-200',
  '待复检': 'bg-orange-50 text-orange-600 border-orange-200',
  '待库位清点': 'bg-blue-50 text-blue-600 border-blue-200',
}

const tabOptions: Array<{ key: 'all' | ReminderCategory; label: string }> = [
  { key: 'all', label: '全部' },
  { key: '待批文', label: '待批文' },
  { key: '待复检', label: '待复检' },
  { key: '待库位清点', label: '待库位清点' },
]

type TabKey = typeof tabOptions[number]['key']

interface StatCard {
  key: string
  label: string
  icon: typeof AlertTriangle
  bgColor: string
  textColor: string
  borderColor: string
  tabKey: TabKey
}

const statCards: StatCard[] = [
  {
    key: 'total',
    label: '总超期',
    icon: AlertTriangle,
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    tabKey: 'all',
  },
  {
    key: 'pendingDoc',
    label: '待批文',
    icon: FileText,
    bgColor: 'bg-red-50',
    textColor: 'text-red-600',
    borderColor: 'border-red-200',
    tabKey: '待批文',
  },
  {
    key: 'pendingRecheck',
    label: '待复检',
    icon: RefreshCw,
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-200',
    tabKey: '待复检',
  },
  {
    key: 'pendingInventory',
    label: '待库位清点',
    icon: MapPin,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    tabKey: '待库位清点',
  },
]

export default function Reminder() {
  const {
    reminders,
    reminderStats,
    samples,
    currentUser,
    fetchReminders,
    fetchReminderStats,
    fetchSamples,
    updateReminder,
    reassignReminder,
  } = useStore()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [responsibleFilter, setResponsibleFilter] = useState('')
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [newResponsible, setNewResponsible] = useState('')
  const [reassignReason, setReassignReason] = useState('')
  const [historyPersons, setHistoryPersons] = useState<string[]>([])

  useEffect(() => {
    fetchReminders()
    fetchReminderStats()
    fetchSamples()
  }, [fetchReminders, fetchReminderStats, fetchSamples])

  useEffect(() => {
    const persons = Array.from(new Set(reminders.map((r) => r.responsiblePerson).filter(Boolean)))
    setHistoryPersons(persons)
    setNewResponsible(currentUser.name)
  }, [reminders, currentUser.name])

  const computedStats = useMemo(() => {
    if (reminderStats) {
      return {
        total: reminderStats.total,
        pendingDoc: reminderStats.pendingDoc,
        pendingRecheck: reminderStats.pendingRecheck,
        pendingInventory: reminderStats.pendingInventory,
      }
    }
    return {
      total: reminders.length,
      pendingDoc: reminders.filter((r) => r.category === '待批文').length,
      pendingRecheck: reminders.filter((r) => r.category === '待复检').length,
      pendingInventory: reminders.filter((r) => r.category === '待库位清点').length,
    }
  }, [reminderStats, reminders])

  const filteredReminders = useMemo(() => {
    let list = [...reminders]
    if (activeTab !== 'all') {
      list = list.filter((r) => r.category === activeTab)
    }
    if (responsibleFilter.trim()) {
      list = list.filter((r) => r.responsiblePerson.includes(responsibleFilter.trim()))
    }
    return list.sort((a, b) => b.overdueDays - a.overdueDays)
  }, [reminders, activeTab, responsibleFilter])

  const handleStatCardClick = (tabKey: TabKey) => {
    setActiveTab(tabKey)
  }

  const handleNextStatus = async (id: string, current: ReminderStatus) => {
    const next = nextStatus(current)
    if (next) {
      await updateReminder(id, next)
    }
  }

  const handleOpenReassign = () => {
    if (!selectedRowId) return
    const reminder = reminders.find((r) => r.id === selectedRowId)
    if (reminder) {
      setNewResponsible(currentUser.name)
      setReassignReason('')
      setShowReassignModal(true)
    }
  }

  const handleSubmitReassign = async () => {
    if (!selectedRowId || !newResponsible.trim() || !reassignReason.trim()) return
    await reassignReminder(selectedRowId, newResponsible.trim(), reassignReason.trim())
    setShowReassignModal(false)
    setSelectedRowId(null)
    setNewResponsible(currentUser.name)
    setReassignReason('')
  }

  const selectedReminder: Reminder | undefined = selectedRowId
    ? reminders.find((r) => r.id === selectedRowId)
    : undefined
  const selectedSample = selectedReminder ? samples.find((s) => s.id === selectedReminder.sampleId) : undefined

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          const count = computedStats[card.key as keyof typeof computedStats] || 0
          const isActive = activeTab === card.tabKey
          return (
            <div
              key={card.key}
              onClick={() => handleStatCardClick(card.tabKey)}
              className={cn(
                'bg-white rounded-lg p-5 border shadow-sm cursor-pointer transition-all hover:shadow-md',
                isActive ? 'ring-2 ring-deep-blue border-deep-blue' : card.borderColor
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className={cn('text-3xl font-bold mt-1', card.textColor)}>{count}</p>
                  <p className="text-xs text-slate-400 mt-1">条</p>
                </div>
                <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center', card.bgColor)}>
                  <Icon size={22} className={card.textColor} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {tabOptions.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                  activeTab === tab.key
                    ? 'bg-deep-blue text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="筛选责任人"
                value={responsibleFilter}
                onChange={(e) => setResponsibleFilter(e.target.value)}
                className="w-44 text-sm px-3 py-1.5 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-deep-blue/20 focus:border-deep-blue"
              />
            </div>
            <button
              onClick={handleOpenReassign}
              disabled={!selectedRowId}
              className={cn(
                'text-sm px-4 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all',
                selectedRowId
                  ? 'bg-deep-blue text-white hover:bg-deep-blue/90'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}
            >
              <UserCog size={16} />
              改派
            </button>
          </div>
        </div>

        {filteredReminders.length === 0 ? (
          <div className="py-16 text-center text-slate-400">暂无超期样品</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-5 py-3 text-left font-medium w-10"></th>
                  <th className="px-5 py-3 text-left font-medium">样品编号</th>
                  <th className="px-5 py-3 text-left font-medium">样品名称</th>
                  <th className="px-5 py-3 text-left font-medium">留置到期日</th>
                  <th className="px-5 py-3 text-left font-medium">超期天数</th>
                  <th className="px-5 py-3 text-left font-medium">分类</th>
                  <th className="px-5 py-3 text-left font-medium">责任人</th>
                  <th className="px-5 py-3 text-left font-medium">催办状态</th>
                  <th className="px-5 py-3 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredReminders.map((reminder) => {
                  const sample = samples.find((s) => s.id === reminder.sampleId)
                  const isSelected = selectedRowId === reminder.id
                  return (
                    <tr
                      key={reminder.id}
                      className={cn(
                        'hover:bg-slate-50 cursor-pointer transition-colors',
                        isSelected && 'bg-deep-blue/5'
                      )}
                      onClick={() => reminder.sampleId && navigate(`/trace/${reminder.sampleId}`)}
                    >
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => setSelectedRowId(e.target.checked ? reminder.id : null)}
                          className="w-4 h-4 rounded border-slate-300 text-deep-blue focus:ring-deep-blue"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-1 h-6 rounded-full',
                              reminder.overdueDays > 30
                                ? 'bg-red-600'
                                : reminder.overdueDays > 14
                                ? 'bg-orange-500'
                                : 'bg-slate-400'
                            )}
                          />
                          <span className="font-medium">{sample?.sampleCode || reminder.sampleId}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">{sample?.itemName || '-'}</td>
                      <td className="px-5 py-3 text-slate-500">{sample?.retentionEnd || '-'}</td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'font-bold',
                            reminder.overdueDays > 30
                              ? 'text-red-600'
                              : reminder.overdueDays > 14
                              ? 'text-orange-600'
                              : 'text-slate-600'
                          )}
                        >
                          {reminder.overdueDays} 天
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'text-xs px-2 py-1 rounded-full border font-medium',
                            categoryColor[reminder.category]
                          )}
                        >
                          {reminder.category}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{reminder.responsiblePerson || '-'}</td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'text-xs px-2 py-1 rounded-full border',
                            statusColor[reminder.status]
                          )}
                        >
                          {reminder.status}
                        </span>
                      </td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        {reminder.status !== '已完结' ? (
                          <button
                            onClick={() => handleNextStatus(reminder.id, reminder.status)}
                            className="text-xs bg-deep-blue text-white px-3 py-1.5 rounded hover:bg-deep-blue/90 flex items-center gap-1"
                          >
                            {nextStatus(reminder.status)}
                            <ChevronRight size={12} />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">已完结</span>
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

      {showReassignModal && selectedReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">改派责任人</h3>
              <button
                onClick={() => setShowReassignModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">样品</span>
                  <span className="font-medium text-slate-800">
                    {selectedSample?.sampleCode || selectedReminder.sampleId}
                    {selectedSample?.itemName && `（${selectedSample.itemName}）`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">分类</span>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full border',
                      categoryColor[selectedReminder.category]
                    )}
                  >
                    {selectedReminder.category}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">当前责任人</span>
                  <span className="text-slate-700">{selectedReminder.responsiblePerson || '-'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  新责任人 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newResponsible}
                    onChange={(e) => setNewResponsible(e.target.value)}
                    placeholder="请输入或选择责任人"
                    className="w-full text-sm px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-deep-blue/20 focus:border-deep-blue"
                  />
                  {historyPersons.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-10 max-h-40 overflow-auto">
                      {historyPersons.map((p) => (
                        <div
                          key={p}
                          onClick={() => setNewResponsible(p)}
                          className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer text-slate-700"
                        >
                          {p}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  改派原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="请输入改派原因"
                  rows={3}
                  className="w-full text-sm px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-deep-blue/20 focus:border-deep-blue resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
              <button
                onClick={() => setShowReassignModal(false)}
                className="text-sm px-4 py-2 rounded-md border border-slate-200 text-slate-600 hover:bg-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmitReassign}
                disabled={!newResponsible.trim() || !reassignReason.trim()}
                className={cn(
                  'text-sm px-4 py-2 rounded-md font-medium transition-all',
                  newResponsible.trim() && reassignReason.trim()
                    ? 'bg-deep-blue text-white hover:bg-deep-blue/90'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                确认改派
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
