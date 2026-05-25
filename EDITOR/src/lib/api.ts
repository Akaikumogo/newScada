import axios from 'axios'
import type { Branch, Substation, Device, Signal, DeviceModel, ModelSignal, ApplyResult, RegisterLog } from '@/types'

// ── Axios instance ────────────────────────────────
const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
})

// ── Paginated response ────────────────────────────
export interface Paginated<T> {
  items: T[]
  total: number
}

const PAGE_SIZE = 10

// ── Branches ──────────────────────────────────────
export const branchApi = {
  list: (skip = 0, limit = PAGE_SIZE) =>
    api.get<Paginated<Branch>>('/branches', { params: { skip, limit } }).then(r => r.data),
  create: (data: Pick<Branch, 'name'>) =>
    api.post<Branch>('/branches', data).then(r => r.data),
  update: (id: number, data: Partial<Branch>) =>
    api.put<Branch>(`/branches/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/branches/${id}`),
  bulkDelete: (ids: number[]) =>
    api.post<{ deleted: number }>('/branches/bulk-delete', { ids }).then(r => r.data),
  deleteAll: () =>
    api.post<{ deleted: number }>('/branches/delete-all').then(r => r.data),
}

// ── Substations ───────────────────────────────────
export const substationApi = {
  list: (p?: { branchId?: number; skip?: number; limit?: number }) =>
    api.get<Paginated<Substation>>('/substations', {
      params: { branch_id: p?.branchId, skip: p?.skip ?? 0, limit: p?.limit ?? PAGE_SIZE },
    }).then(r => r.data),
  create: (data: Pick<Substation, 'name' | 'branch_id'>) =>
    api.post<Substation>('/substations', data).then(r => r.data),
  update: (id: number, data: Partial<Substation>) =>
    api.put<Substation>(`/substations/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/substations/${id}`),
  bulkDelete: (ids: number[]) =>
    api.post<{ deleted: number }>('/substations/bulk-delete', { ids }).then(r => r.data),
  deleteAll: () =>
    api.post<{ deleted: number }>('/substations/delete-all').then(r => r.data),
  getSchema: (id: number) =>
    api.get<{ canvas_json: object } | null>(`/substations/${id}/schema`).then(r => r.data),
  saveSchema: (id: number, canvas_json: object) =>
    api.put<{ canvas_json: object }>(`/substations/${id}/schema`, { canvas_json }).then(r => r.data),
}

// ── Device Models ─────────────────────────────────
export const modelApi = {
  list: (skip = 0, limit = PAGE_SIZE) =>
    api.get<Paginated<DeviceModel>>('/device-models', { params: { skip, limit } }).then(r => r.data),
  create: (data: Omit<DeviceModel, 'id' | 'created_at' | 'signal_count'>) =>
    api.post<DeviceModel>('/device-models', data).then(r => r.data),
  update: (id: number, data: Partial<DeviceModel>) =>
    api.put<DeviceModel>(`/device-models/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/device-models/${id}`),
  bulkDelete: (ids: number[]) =>
    api.post<{ deleted: number }>('/device-models/bulk-delete', { ids }).then(r => r.data),
  deleteAll: () =>
    api.post<{ deleted: number }>('/device-models/delete-all').then(r => r.data),

  // Signal kataloqi
  listSignals: (modelId: number, skip = 0, limit = PAGE_SIZE) =>
    api.get<Paginated<ModelSignal>>(`/device-models/${modelId}/signals`, { params: { skip, limit } }).then(r => r.data),
  createSignal: (modelId: number, data: Omit<ModelSignal, 'id' | 'model_id'>) =>
    api.post<ModelSignal>(`/device-models/${modelId}/signals`, data).then(r => r.data),
  updateSignal: (modelId: number, sigId: number, data: Partial<ModelSignal>) =>
    api.put<ModelSignal>(`/device-models/${modelId}/signals/${sigId}`, data).then(r => r.data),
  deleteSignal: (modelId: number, sigId: number) =>
    api.delete(`/device-models/${modelId}/signals/${sigId}`),
  bulkDeleteSignals: (modelId: number, ids: number[]) =>
    api.post<{ deleted: number }>(`/device-models/${modelId}/signals/bulk-delete`, { ids }).then(r => r.data),
  deleteAllSignals: (modelId: number) =>
    api.post<{ deleted: number }>(`/device-models/${modelId}/signals/delete-all`).then(r => r.data),

  // Katalogni qurilmalarga qo'llash
  applyToDevice: (modelId: number, deviceId: number) =>
    api.post<ApplyResult>(`/device-models/${modelId}/apply/${deviceId}`).then(r => r.data),
  applyToAll: (modelId: number) =>
    api.post<ApplyResult>(`/device-models/${modelId}/apply-all`).then(r => r.data),
}

// ── Devices ───────────────────────────────────────
export const deviceApi = {
  listAll: (skip = 0, limit = PAGE_SIZE) =>
    api.get<Paginated<Device>>('/devices', { params: { skip, limit } }).then(r => r.data),
  list: (substationId: number) =>
    api.get<Paginated<Device>>('/devices', { params: { substation_id: substationId, limit: 0 } }).then(r => r.data),
  getById: (id: number) =>
    api.get<Device>(`/devices/${id}`).then(r => r.data),
  create: (data: Omit<Device, 'id' | 'created_at' | 'signals'>) =>
    api.post<Device>('/devices', data).then(r => r.data),
  update: (id: number, data: Partial<Device>) =>
    api.put<Device>(`/devices/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/devices/${id}`),
  bulkDelete: (ids: number[]) =>
    api.post<{ deleted: number }>('/devices/bulk-delete', { ids }).then(r => r.data),
  deleteAll: () =>
    api.post<{ deleted: number }>('/devices/delete-all').then(r => r.data),

  /** Excel import */
  importExcel: async (deviceId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<{
      total_in_file: number
      applied: number
      skipped: number
      device_id: number
      device_name: string
    }>(`/devices/${deviceId}/signals/import-excel`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    })
    return res.data
  },
}

// ── Signals ───────────────────────────────────────
export const signalApi = {
  list: (deviceId: number, skip = 0, limit = PAGE_SIZE) =>
    api.get<Paginated<Signal>>('/signals', { params: { device_id: deviceId, skip, limit } }).then(r => r.data),
  create: (data: Omit<Signal, 'id'>) =>
    api.post<Signal>('/signals', data).then(r => r.data),
  update: (id: number, data: Partial<Signal>) =>
    api.put<Signal>(`/signals/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/signals/${id}`),
  bulkDelete: (ids: number[]) =>
    api.post<{ deleted: number }>('/signals/bulk-delete', { ids }).then(r => r.data),
  deleteAll: (deviceId: number) =>
    api.post<{ deleted: number }>('/signals/delete-all', { device_id: deviceId }).then(r => r.data),
  bulkSetActive: (ids: number[], active: boolean) =>
    api.post<{ updated: number }>('/signals/bulk-set-active', { ids, active }).then(r => r.data),
  setActiveAll: (deviceId: number, active: boolean) =>
    api.post<{ updated: number }>('/signals/set-active-all', { device_id: deviceId, active }).then(r => r.data),
}

export const logApi = {
  recent: (params?: { device_id?: number; register_code?: number; signal_name?: string; limit?: number }) =>
    api.get<{ items: RegisterLog[] }>('/log/recent', { params }).then(r => r.data),
}
