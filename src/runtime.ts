import type { ReminderPayload } from './types'

interface BotLike {
  platform?: string
  isActive?: boolean
  sendMessage?: (...args: any[]) => any
}

export function buildCronJobs(dailyCronExprs: string[], rawCronExprs: string[]) {
  return [...new Set([...dailyCronExprs, ...rawCronExprs].filter(Boolean))]
}

export function shouldSkipByDedupe(
  cache: Map<string, number>,
  key: string,
  now: number,
  dedupeWindowSeconds: number,
) {
  const previous = cache.get(key)
  cache.set(key, now)
  if (previous == null) return false
  return now - previous < dedupeWindowSeconds * 1000
}

export function buildPayload(text: string, imagePath?: string): ReminderPayload {
  return imagePath ? { text, imagePath } : { text }
}

export function selectReminderBot<T extends BotLike>(bots: T[]) {
  const activeBots = bots.filter((bot) => bot.isActive !== false && typeof bot.sendMessage === 'function')
  return activeBots.find((bot) => bot.platform === 'qq') || activeBots[0]
}
