import { create } from 'zustand'
import type {
  Sample,
  Disposal,
  FlowTrace,
  Warehouse,
  Reminder,
  CurrentUser,
  UserRole,
  TestConclusion,
  DisposalType,
  DisposalStatus,
  CaseInfo,
  RecheckConclusion,
  Extension,
  FreezeRecord,
  SplitSample,
} from '@/types'

interface ValidationResult {
  canProceed: boolean
  freezeBlocked: boolean
  retention: { passed: boolean; message: string }
  doc: { passed: boolean; message: string }
  review: { passed: boolean; message: string }
}

interface ReminderStats {
  total: number
  pendingDoc: number
  pendingRecheck: number
  pendingInventory: number
  byStatus: Record<string, number>
}

interface AppState {
  samples: Sample[]
  currentSample: Sample | null
  warehouses: Warehouse[]
  disposals: Disposal[]
  reminders: Reminder[]
  reminderStats: ReminderStats | null
  flowTraces: FlowTrace[]
  cases: CaseInfo[]
  extensions: Extension[]
  freezeRecords: FreezeRecord[]
  splitSamples: SplitSample[]
  pendingRecheckSamples: { samples: Sample[]; testResults: any[] } | null
  currentUser: CurrentUser
  loading: boolean
  error: string | null

  setCurrentUser: (user: CurrentUser) => void
  switchRole: (role: UserRole) => void

  fetchSamples: (params?: Record<string, string>) => Promise<void>
  fetchSampleById: (id: string) => Promise<void>
  createSample: (data: Partial<Sample> & { relatedCases?: Array<{ caseNo: string; caseName?: string; isPrimary?: boolean }> }) => Promise<Sample | null>
  updateSample: (id: string, data: Partial<Sample>) => Promise<void>
  searchCases: (keyword?: string) => Promise<void>
  addCaseToSample: (sampleId: string, data: { caseNo: string; caseName?: string; isPrimary?: boolean; assignedBy?: string }) => Promise<void>
  splitSample: (sampleId: string, data: { splitQuantity: number; splitReason?: string; childSampleCode?: string; createdBy?: string }) => Promise<Sample | null>

  submitTestResult: (id: string, data: { conclusion: TestConclusion; testDate: string; tester: string; reportFile: string }) => Promise<void>
  submitRecheckResult: (sampleId: string, data: { testResultId: string; recheckConclusion: RecheckConclusion; recheckDate: string; recheckTester: string; recheckReportFile?: string }) => Promise<void>
  fetchPendingRecheck: () => Promise<void>

  fetchWarehouses: () => Promise<void>
  allocateWarehouse: (warehouseId: string, sampleId: string) => Promise<void>
  confirmIn: (sampleId: string) => Promise<void>

  validateDisposal: (data: { sampleId: string; type: DisposalType; disposalDocNo?: string }) => Promise<ValidationResult | null>
  fetchDisposals: () => Promise<void>
  fetchExtensions: () => Promise<void>
  fetchFreezeRecords: () => Promise<void>
  fetchSplitSamples: () => Promise<void>
  createDisposal: (data: Record<string, any>) => Promise<void>
  approveDisposal: (id: string, status: DisposalStatus, comment: string) => Promise<void>
  executeDisposal: (id: string) => Promise<void>

  fetchReminders: () => Promise<void>
  fetchReminderStats: () => Promise<void>
  updateReminder: (id: string, status: Reminder['status']) => Promise<void>
  reassignReminder: (id: string, responsiblePerson: string, reason?: string) => Promise<void>

  fetchTraces: (sampleId: string) => Promise<void>
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const useStore = create<AppState>((set, get) => ({
  samples: [],
  currentSample: null,
  warehouses: [],
  disposals: [],
  reminders: [],
  reminderStats: null,
  flowTraces: [],
  cases: [],
  extensions: [],
  freezeRecords: [],
  splitSamples: [],
  pendingRecheckSamples: null,
  currentUser: { name: '张三', role: '管理员' },
  loading: false,
  error: null,

  setCurrentUser: (user) => set({ currentUser: user }),
  switchRole: (role) => set((s) => ({ currentUser: { ...s.currentUser, role } })),

  fetchSamples: async (params) => {
    set({ loading: true, error: null })
    try {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      const data = await api<{ data: Sample[] }>(`/api/samples${qs}`)
      set({ samples: data.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchSampleById: async (id) => {
    set({ loading: true, error: null })
    try {
      const data = await api<{ data: Sample }>(`/api/samples/${id}`)
      set({ currentSample: data.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createSample: async (data) => {
    set({ loading: true, error: null })
    try {
      const res = await api<{ data: Sample }>('/api/samples', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      set((s) => ({ samples: [...s.samples, res.data], loading: false }))
      return res.data
    } catch (e: any) {
      set({ error: e.message, loading: false })
      return null
    }
  },

  updateSample: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const res = await api<{ data: Sample }>(`/api/samples/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      set((s) => ({
        samples: s.samples.map((s) => (s.id === id ? res.data : s)),
        currentSample: s.currentSample?.id === id ? res.data : s.currentSample,
        loading: false,
      }))
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  searchCases: async (keyword) => {
    set({ loading: true, error: null })
    try {
      const qs = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
      const data = await api<{ data: CaseInfo[] }>(`/api/cases${qs}`)
      set({ cases: data.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  addCaseToSample: async (sampleId, data) => {
    set({ loading: true, error: null })
    try {
      await api(`/api/samples/${sampleId}/add-case`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      await get().fetchSampleById(sampleId)
      await get().fetchSamples()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  splitSample: async (sampleId, data) => {
    set({ loading: true, error: null })
    try {
      const res = await api<{ data: Sample }>(`/api/samples/${sampleId}/split`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      await get().fetchSamples()
      await get().fetchSplitSamples()
      set({ loading: false })
      return res.data
    } catch (e: any) {
      set({ error: e.message, loading: false })
      return null
    }
  },

  submitTestResult: async (id, data) => {
    set({ loading: true, error: null })
    try {
      await api(`/api/samples/${id}/testing`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      await get().fetchSamples()
      await get().fetchPendingRecheck()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  submitRecheckResult: async (sampleId, data) => {
    set({ loading: true, error: null })
    try {
      await api(`/api/samples/${sampleId}/recheck`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      await get().fetchSamples()
      await get().fetchPendingRecheck()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchPendingRecheck: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api<{ data: any }>('/api/samples/pending-recheck')
      set({ pendingRecheckSamples: data.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchWarehouses: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api<{ data: Warehouse[] }>('/api/warehouses')
      set({ warehouses: data.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  allocateWarehouse: async (warehouseId, sampleId) => {
    set({ loading: true, error: null })
    try {
      await api('/api/warehouses/allocate', {
        method: 'POST',
        body: JSON.stringify({ warehouseId, sampleId }),
      })
      await get().fetchWarehouses()
      await get().fetchSamples()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  confirmIn: async (sampleId) => {
    set({ loading: true, error: null })
    try {
      await api(`/api/samples/${sampleId}/confirm-in`, { method: 'PUT' })
      await get().fetchSamples()
      await get().fetchWarehouses()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  validateDisposal: async (data) => {
    set({ error: null })
    try {
      const res = await api<{ data: ValidationResult }>('/api/disposals/validate', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.data
    } catch (e: any) {
      set({ error: e.message })
      return null
    }
  },

  fetchDisposals: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api<{ data: Disposal[] }>('/api/disposals')
      set({ disposals: data.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchExtensions: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api<{ data: Extension[] }>('/api/extensions')
      set({ extensions: data.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchFreezeRecords: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api<{ data: FreezeRecord[] }>('/api/freeze-records')
      set({ freezeRecords: data.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchSplitSamples: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api<{ data: SplitSample[] }>('/api/split-samples')
      set({ splitSamples: data.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createDisposal: async (data) => {
    set({ loading: true, error: null })
    try {
      await api('/api/disposals', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      await get().fetchDisposals()
      await get().fetchSamples()
      await get().fetchExtensions()
      await get().fetchFreezeRecords()
      await get().fetchSplitSamples()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  approveDisposal: async (id, status, comment) => {
    set({ loading: true, error: null })
    try {
      await api(`/api/disposals/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ status, approvalComment: comment }),
      })
      await get().fetchDisposals()
      await get().fetchSamples()
      await get().fetchExtensions()
      await get().fetchFreezeRecords()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  executeDisposal: async (id) => {
    set({ loading: true, error: null })
    try {
      await api(`/api/disposals/${id}/execute`, { method: 'PUT' })
      await get().fetchDisposals()
      await get().fetchSamples()
      await get().fetchWarehouses()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchReminders: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api<{ data: Reminder[]; stats: ReminderStats }>('/api/reminders')
      set({ reminders: data.data, reminderStats: data.stats || null, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchReminderStats: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api<{ data: ReminderStats }>('/api/reminders/stats')
      set({ reminderStats: data.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  updateReminder: async (id, status) => {
    set({ loading: true, error: null })
    try {
      await api(`/api/reminders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      await get().fetchReminders()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  reassignReminder: async (id, responsiblePerson, reason) => {
    set({ loading: true, error: null })
    try {
      await api(`/api/reminders/${id}/reassign`, {
        method: 'POST',
        body: JSON.stringify({ responsiblePerson, reason }),
      })
      await get().fetchReminders()
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchTraces: async (sampleId) => {
    set({ loading: true, error: null })
    try {
      const data = await api<{ data: FlowTrace[] }>(`/api/samples/${sampleId}/trace`)
      set({ flowTraces: data.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },
}))
