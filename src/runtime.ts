import type { ReminderPayload } from './types'

interface BotLike {
  platform?: string
  isActive?: boolean
  sendMessage?: (...args: any[]) => any
  internal?: {
    _request?: (action: string, params: Record<string, unknown>) => Promise<unknown>
  }
}

type ReminderBot = BotLike & {
  sendMessage: (...args: any[]) => any
}

function canSendReminder<T extends BotLike>(bot: T): bot is T & ReminderBot {
  return bot.isActive !== false && typeof bot.sendMessage === 'function'
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

function parseEmojiLikeMessageId(messageId: string) {
  const trimmed = messageId.trim()
  return /^\d+$/.test(trimmed) ? trimmed : undefined
}

function collectMessageIds(result: unknown, output: string[]) {
  if (result == null) return

  if (typeof result === 'string' || typeof result === 'number' || typeof result === 'bigint') {
    const messageId = String(result).trim()
    if (messageId) output.push(messageId)
    return
  }

  if (Array.isArray(result)) {
    for (const item of result) {
      collectMessageIds(item, output)
    }
    return
  }

  if (typeof result === 'object') {
    const record = result as Record<string, unknown>
    const candidates = [
      record.messageId,
      record.message_id,
      record.id,
      record.data,
    ]
    for (const candidate of candidates) {
      collectMessageIds(candidate, output)
    }
  }
}

export function extractMessageIds(result: unknown) {
  const output: string[] = []
  collectMessageIds(result, output)
  return [...new Set(output)]
}

export function buildEmojiLikeRequest(messageId: string, emojiId: number) {
  const normalizedMessageId = parseEmojiLikeMessageId(messageId)
  if (!normalizedMessageId) {
    throw new Error('Invalid emoji-like message id')
  }
  return {
    message_id: Number(normalizedMessageId),
    emoji_id: emojiId,
  }
}

export function getEmojiLikeRequester(bot: BotLike) {
  const request = bot.internal?._request
  if (typeof request !== 'function') return
  return request.bind(bot.internal)
}

export function shouldApplyEmojiLike(input: {
  enabled: boolean
  emojiIds: number[]
  messageId?: string
}) {
  const normalizedMessageId = input.messageId && parseEmojiLikeMessageId(input.messageId)
  return input.enabled
    && input.emojiIds.length > 0
    && !!normalizedMessageId
}

export function getEmojiLikeFailure(response: unknown) {
  if (!response || typeof response !== 'object') return

  const record = response as Record<string, unknown>
  const wording = [record.wording, record.message, record.msg]
    .find((item) => typeof item === 'string' && item.trim()) as string | undefined
  const suffix = wording ? `: ${wording}` : ''

  if (typeof record.retcode === 'number' && record.retcode !== 0) {
    return `retcode ${record.retcode}${suffix}`
  }

  if (typeof record.retcode === 'string' && record.retcode !== '0') {
    return `retcode ${record.retcode}${suffix}`
  }

  if (typeof record.status === 'string' && /^(failed|error)$/i.test(record.status)) {
    return `status ${record.status}${suffix}`
  }
}

export function selectReminderBot<T extends BotLike>(bots: T[]) {
  const activeBots = bots.filter(canSendReminder)
  return activeBots.find((bot) => bot.platform === 'onebot') || activeBots[0]
}
