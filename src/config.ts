function parseDailyTime(value: string) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim())
  if (!match) return null
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  }
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

export function normalizeExtensions(values: string[]) {
  return [...new Set(
    values
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .map((value) => value.startsWith('.') ? value : `.${value}`),
  )].sort()
}
