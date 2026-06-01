import { useEffect, useState } from 'react'
import type { RangePoint } from '@/lib/api'

type Row = Record<string, number>

interface ChunkedRows {
  rows: Row[]
  isProcessing: boolean
}

export function useChunkedRangeRows(
  dataMap: Record<string, RangePoint[]>,
  value: keyof Pick<RangePoint, 'avg' | 'open' | 'high' | 'low' | 'close'> = 'avg',
): ChunkedRows {
  const [rows, setRows] = useState<Row[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    let cancelled = false
    let frame = 0
    const entries = Object.entries(dataMap)
    const totalPoints = entries.reduce((sum, [, points]) => sum + points.length, 0)

    if (totalPoints === 0) {
      setRows([])
      setIsProcessing(false)
      return
    }

    setIsProcessing(true)
    setRows([])

    const merged = new Map<number, Row>()
    let entryIndex = 0
    let pointIndex = 0
    const chunkSize = totalPoints > 80_000 ? 6_000 : 2_000

    const publish = () => {
      setRows(Array.from(merged.values()).sort((a, b) => a.ts - b.ts))
    }

    const step = () => {
      if (cancelled) return

      let processed = 0
      while (entryIndex < entries.length && processed < chunkSize) {
        const [key, points] = entries[entryIndex]
        const point = points[pointIndex]
        const ts = new Date(point.ts).getTime()
        if (!merged.has(ts)) merged.set(ts, { ts })
        merged.get(ts)![key] = point[value]

        pointIndex += 1
        processed += 1

        if (pointIndex >= points.length) {
          entryIndex += 1
          pointIndex = 0
        }
      }

      publish()

      if (entryIndex < entries.length) {
        frame = window.requestAnimationFrame(step)
      } else {
        setIsProcessing(false)
      }
    }

    frame = window.requestAnimationFrame(step)

    return () => {
      cancelled = true
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [dataMap, value])

  return { rows, isProcessing }
}
