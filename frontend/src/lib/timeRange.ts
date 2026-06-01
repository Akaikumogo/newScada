export type HistoryRange = '15m' | '1h' | '6h' | '1d' | '1w' | '1mo' | '3mo' | '1y'

export interface RangePreset {
  value: HistoryRange
  label: string
  shortLabel: string
  ms: number
}

export const RANGE_PRESETS: RangePreset[] = [
  { value: '15m', label: '15 minut', shortLabel: '15m', ms: 15 * 60_000 },
  { value: '1h',  label: '1 soat',   shortLabel: '1h',  ms: 60 * 60_000 },
  { value: '6h',  label: '6 soat',   shortLabel: '6h',  ms: 6 * 60 * 60_000 },
  { value: '1d',  label: '1 kun',    shortLabel: '1d',  ms: 24 * 60 * 60_000 },
  { value: '1w',  label: '1 hafta',  shortLabel: '1w',  ms: 7 * 24 * 60 * 60_000 },
  { value: '1mo', label: '1 oy',     shortLabel: '1oy', ms: 30 * 24 * 60 * 60_000 },
  { value: '3mo', label: '3 oy',     shortLabel: '3oy', ms: 90 * 24 * 60 * 60_000 },
  { value: '1y',  label: '1 yil',    shortLabel: '1y',  ms: 365 * 24 * 60 * 60_000 },
]

export function presetMs(value: HistoryRange): number {
  return RANGE_PRESETS.find(p => p.value === value)?.ms ?? RANGE_PRESETS[1].ms
}

export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function fromLocalInputValue(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function roundedQueryDate(date: Date, stepMs = 30_000): Date {
  return new Date(Math.floor(date.getTime() / stepMs) * stepMs)
}
