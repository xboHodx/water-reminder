import test from 'node:test'
import assert from 'node:assert/strict'

import { apply } from '../src/index'

type ReadyCallback = () => Promise<void> | void

function createContext() {
  const infos: string[] = []
  const warnings: string[] = []
  const posts: Array<{ url: string, body: unknown, options: unknown }> = []
  let ready: ReadyCallback | undefined

  const ctx = {
    bots: [
      {
        platform: 'qq',
        isActive: true,
        sendMessage: async () => ['123', '456'],
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
    http: {
      post: async (url: string, body: unknown, options: unknown) => {
        posts.push({ url, body, options })
        return { retcode: 0 }
      },
    },
    sleep: async () => {},
    setInterval() {},
  }

  return {
    ctx,
    infos,
    warnings,
    posts,
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
      onebotUrl: 'http://127.0.0.1:3000',
      onebotToken: '',
      emojiIds: [76, 77],
      delayMs: 0,
    },
    behavior: {
      sendOnStartup: true,
      dedupeWindowSeconds: 60,
    },
  } as const
}

test('apply posts emoji likes for every sendMessage result and every emoji id', async () => {
  const { ctx, infos, posts, ready } = createContext()

  apply(ctx as any, baseConfig() as any)
  await ready()

  assert.equal(posts.length, 4)
  assert.deepEqual(
    posts.map((entry) => entry.body),
    [
      { message_id: 123, emoji_id: 76 },
      { message_id: 123, emoji_id: 77 },
      { message_id: 456, emoji_id: 76 },
      { message_id: 456, emoji_id: 77 },
    ],
  )
  assert.ok(
    infos.some((message) => message.includes('applied emoji like')),
    'expected a successful apply log',
  )
})

test('apply warns when OneBot HTTP returns a logical failure payload', async () => {
  const { ctx, warnings, ready } = createContext()
  ctx.http.post = async () => ({ retcode: 1200 })

  apply(ctx as any, baseConfig() as any)
  await ready()

  assert.ok(
    warnings.some((message) => message.includes('failed to apply emoji like')),
    'expected a failed-to-apply warning',
  )
})

test('apply warns when OneBot HTTP returns a failed status payload', async () => {
  const { ctx, warnings, ready } = createContext()
  ctx.http.post = async () => ({ status: 'failed', message: 'not allowed' })

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
    {
      name: 'blank onebotUrl',
      emojiLike: { ...baseConfig().emojiLike, onebotUrl: '   ' },
    },
  ]

  for (const item of cases) {
    const { ctx, posts, ready } = createContext()
    apply(ctx as any, {
      ...baseConfig(),
      emojiLike: item.emojiLike,
    } as any)
    await ready()
    assert.equal(posts.length, 0, `expected no OneBot posts for ${item.name}`)
  }
})
