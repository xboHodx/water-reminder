import { BUILTIN_MESSAGES, FALLBACK_MESSAGE } from './constants'
import type { MessageConfig } from './types'

export function buildMessagePool(config: MessageConfig) {
  const custom = config.customMessages.map((item) => item.trim()).filter(Boolean)

  if (config.mode === 'builtin') return [...BUILTIN_MESSAGES]
  if (config.mode === 'custom') return custom.length ? custom : [...BUILTIN_MESSAGES]

  const merged = [...BUILTIN_MESSAGES, ...custom]
  return merged.length ? merged : [FALLBACK_MESSAGE]
}

export function pickMessage(pool: string[], index = Math.floor(Math.random() * pool.length)) {
  if (!pool.length) return FALLBACK_MESSAGE
  return pool[index % pool.length] || FALLBACK_MESSAGE
}
