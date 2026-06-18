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
} from '@/types'

interface AppState {
  samples: Sample[]
  currentSample: Sample | null
  warehouses: Warehouse[]
  disposals: Disposal[]
  reminders: Reminder[]
  flowTraces: FlowTrace[]
  currentUser: CurrentUser
  loading: boolean
  error: string | null

  setCurrentUser: (user: CurrentUser) => void
  switchRole: (role: UserRole) => void

  fetchSamples: (params?: Record<string, string>) => Promise<void>
  fetchSampleById: (id: string) => Promise<void>
  createSample: (data: Partial<Sample>) => Promise<Sample | null>
  updateSample: (id: string, data: Partial<Sample>) => Promise<void>
  submitTestResult: (id: string, data: { conclusion: TestConclusion; testDate: string; tester: string; reportFile: string }) => Promise<void>

  fetchWarehouses: () => Promise<void>
  allocateWarehouse: (warehouseId: string, sampleId: string) => Promise<void>
  confirmIn: (sampleId: string) => Promise<void>

  fetchDisposals: () => Promise<void>
  createDisposal: (data: { sampleId: string; type: DisposalType; reason: string; destination: string; destroyMethod: string; witness: string; disposalDocNo: string }) => Promise<void>
  approveDisposal: (id: string, status: DisposalStatus, comment: string) => Promise<void>

  fetchReminders: () => Promise<void>
  updateReminder: (id: string, status: Reminder['status']) => Promise<void>

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
  flowTraces: [],
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

  submitTestResult: async (id, data) => {
    set({ loading: true, error: null })
    try {
      await api(`/api/samples/${id}/testing`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      await get().fetchSamples()
      set({ loading: false })
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

  fetchDisposals: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api<{ data: Disposal[] }>('/api/disposals')
      set({ disposals: data.data, loading: false })
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
      set({ loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchReminders: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api<{ data: Reminder[] }>('/api/reminders')
      set({ reminders: data.data, loading: false })
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
