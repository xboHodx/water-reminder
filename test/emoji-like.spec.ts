import test from 'node:test'
import assert from 'node:assert/strict'

import { apply } from '../src/index'

type ReadyCallback = () => Promise<void> | void

function createContext() {
  const infos: string[] = []
  const warnings: string[] = []
  const requests: Array<{ action: string, params: Record<string, unknown> }> = []
  let ready: ReadyCallback | undefined

  const ctx = {
    bots: [
      {
        platform: 'qq',
        isActive: true,
        sendMessage: async () => ['123', '456'],
        internal: {
          async _request(action: string, params: Record<string, unknown>) {
            requests.push({ action, params })
            return { retcode: 0 }
          },
        },
      },
    ],
    logger() {
      return {
        info(message: string) {
          infos.push(message)
        },
        debug() {},
        warn(message: string) {
          warnings.push(message)
        },
      }
    },
    on(event: string, callback: ReadyCallback) {
      if (event === 'ready') ready = callback
    },
    sleep: async () => {},
    setInterval() {},
  }

  return {
    ctx,
    infos,
    warnings,
    requests,
    ready: async () => {
      assert.ok(ready, 'ready callback should be registered')
      await ready?.()
    },
  }
}

function baseConfig() {
  return {
    enabledGroups: ['123456789'],
    schedule: {
      dailyTimes: [],
      cronExprs: [],
      intervalMinutes: [],
    },
    message: {
      mode: 'builtin',
      customMessages: [],
    },
    image: {
      enabled: false,
      directory: 'data/water-reminder-images',
      allowedExtensions: ['.png'],
    },
    emojiLike: {
      enabled: true,
      emojiIds: [76, 77],
      delayMs: 0,
    },
    behavior: {
      sendOnStartup: true,
      dedupeWindowSeconds: 60,
    },
  } as const
}

test('apply requests emoji likes through bot.internal for every sendMessage result and every emoji id', async () => {
  const { ctx, infos, requests, ready } = createContext()

  apply(ctx as any, baseConfig() as any)
  await ready()

  assert.equal(requests.length, 4)
  assert.deepEqual(
    requests,
    [
      { action: 'set_msg_emoji_like', params: { message_id: 123, emoji_id: 76 } },
      { action: 'set_msg_emoji_like', params: { message_id: 123, emoji_id: 77 } },
      { action: 'set_msg_emoji_like', params: { message_id: 456, emoji_id: 76 } },
      { action: 'set_msg_emoji_like', params: { message_id: 456, emoji_id: 77 } },
    ],
  )
  assert.ok(
    infos.some((message) => message.includes('applied emoji like')),
    'expected a successful apply log',
  )
})

test('apply warns when bot.internal returns a logical failure payload', async () => {
  const { ctx, warnings, ready } = createContext()
  ctx.bots[0].internal._request = async () => ({ retcode: 1200 })

  apply(ctx as any, baseConfig() as any)
  await ready()

  assert.ok(
    warnings.some((message) => message.includes('failed to apply emoji like')),
    'expected a failed-to-apply warning',
  )
})

test('apply warns when bot.internal returns a failed status payload', async () => {
  const { ctx, warnings, ready } = createContext()
  ctx.bots[0].internal._request = async () => ({ status: 'failed', message: 'not allowed' })

  apply(ctx as any, baseConfig() as any)
  await ready()

  assert.ok(
    warnings.some((message) => message.includes('failed to apply emoji like')),
    'expected a failed-to-apply warning for failed status',
  )
})

test('apply warns about failed emoji-like processing when ctx.sleep throws', async () => {
  const { ctx, warnings, ready } = createContext()
  ctx.sleep = async () => {
    throw new Error('sleep failed')
  }

  apply(ctx as any, {
    ...baseConfig(),
    emojiLike: {
      ...baseConfig().emojiLike,
      delayMs: 1,
    },
  } as any)
  await ready()

  assert.ok(
    warnings.some((message) => message.includes('failed to apply emoji like')),
    'expected a failed-to-apply warning',
  )
  assert.equal(
    warnings.some((message) => message.includes('failed to send startup reminder')),
    false,
    'sleep failure should not be reported as a send failure',
  )
})

test('apply warns and skips emoji likes when bot.internal._request is unavailable', async () => {
  const { ctx, warnings, requests, ready } = createContext()
  delete ctx.bots[0].internal

  apply(ctx as any, baseConfig() as any)
  await ready()

  assert.equal(requests.length, 0)
  assert.ok(
    warnings.some((message) => message.includes('does not support bot.internal._request')),
    'expected a missing internal requester warning',
  )
})

test('apply skips OneBot requests when emoji-like is disabled or misconfigured', async () => {
  const cases = [
    {
      name: 'disabled',
      emojiLike: { ...baseConfig().emojiLike, enabled: false },
    },
    {
      name: 'no emoji ids',
      emojiLike: { ...baseConfig().emojiLike, emojiIds: [] },
    },
  ]

  for (const item of cases) {
    const { ctx, requests, ready } = createContext()
    apply(ctx as any, {
      ...baseConfig(),
      emojiLike: item.emojiLike,
    } as any)
    await ready()
    assert.equal(requests.length, 0, `expected no OneBot requests for ${item.name}`)
  }
})
