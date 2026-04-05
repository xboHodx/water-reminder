import type { ActiveTimeRange } from './types'

function parseDailyTime(value: string) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim())
  if (!match) return null
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  }
}

function parseTimePoint(value: string) {
  const parsed = parseDailyTime(value)
  if (!parsed) return null
  return parsed.hour * 60 + parsed.minute
}

export function expandDailyTimes(values: string[]) {
  return values
    .map(parseDailyTime)
    .filter((value): value is { hour: number; minute: number } => !!value)
    .map(({ hour, minute }) => `${minute} ${hour} * * *`)
}

export function normalizeIntervalMinutes(values: number[]) {
  return [...new Set(
    values.filter((value) => Number.isInteger(value) && value > 0),
  )].sort((a, b) => a - b)
}

export function normalizeActiveTimeRanges(values: string[]) {
  const seen = new Set<string>()
  const output: ActiveTimeRange[] = []

  for (const rawValue of values) {
    const [rawStart, rawEnd, extra] = rawValue.split('-')
    if (!rawStart || !rawEnd || extra) continue

    const startMinute = parseTimePoint(rawStart)
    const endMinute = parseTimePoint(rawEnd)
    if (startMinute == null || endMinute == null) continue

    const key = `${startMinute}-${endMinute}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push({ startMinute, endMinute })
  }

  return output.sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute)
}

export function isMinuteInActiveTimeRanges(ranges: ActiveTimeRange[], minute: number) {
  if (!ranges.length) return true

  return ranges.some(({ startMinute, endMinute }) => {
    if (startMinute <= endMinute) {
      return minute >= startMinute && minute <= endMinute
    }
    return minute >= startMinute || minute <= endMinute
  })
}

export function normalizeExtensions(values: string[]) {
  return [...new Set(
    values
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .map((value) => value.startsWith('.') ? value : `.${value}`),
  )].sort()
}
