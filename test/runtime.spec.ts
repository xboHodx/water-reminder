import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCronJobs,
  buildEmojiLikeHeaders,
  buildEmojiLikeRequest,
  buildPayload,
  selectReminderBot,
  shouldApplyEmojiLike,
  shouldSkipByDedupe,
} from '../src/runtime'

test('buildCronJobs merges cron expressions with raw cron expressions', () => {
  assert.deepEqual(
    buildCronJobs(['30 9 * * *'], ['0 12 * * *']),
    ['30 9 * * *', '0 12 * * *'],
  )
})

test('shouldSkipByDedupe skips duplicate sends inside the same dedupe window', () => {
  const seen = new Map<string, number>()
  assert.equal(shouldSkipByDedupe(seen, '2026-04-03T10:00', 1712109600000, 60), false)
  assert.equal(shouldSkipByDedupe(seen, '2026-04-03T10:00', 1712109605000, 60), true)
})

test('buildPayload includes imagePath only when an image is available', () => {
  assert.deepEqual(buildPayload('记得喝水', '/tmp/a.png'), {
    text: '记得喝水',
    imagePath: '/tmp/a.png',
  })
  assert.deepEqual(buildPayload('记得喝水'), {
    text: '记得喝水',
  })
})

test('buildEmojiLikeRequest builds a OneBot payload for one emoji id', () => {
  assert.deepEqual(buildEmojiLikeRequest('12345', 76), {
    message_id: 12345,
    emoji_id: 76,
  })
})

test('buildEmojiLikeRequest throws for invalid message ids', () => {
  assert.throws(() => buildEmojiLikeRequest('abc', 76), /invalid emoji-like message id/i)
})

test('buildEmojiLikeHeaders adds bearer token only when configured', () => {
  assert.deepEqual(buildEmojiLikeHeaders(), {
    'Content-Type': 'application/json',
  })
  assert.deepEqual(buildEmojiLikeHeaders('secret'), {
    'Content-Type': 'application/json',
    Authorization: 'Bearer secret',
  })
})

test('shouldApplyEmojiLike returns true when all emoji-like conditions are met', () => {
  assert.equal(
    shouldApplyEmojiLike({
      enabled: true,
      onebotUrl: 'http://127.0.0.1:3000',
      emojiIds: [76],
      messageId: '12345',
    }),
    true,
  )

  assert.equal(
    shouldApplyEmojiLike({
      enabled: false,
      onebotUrl: 'http://127.0.0.1:3000',
      emojiIds: [76],
      messageId: '12345',
    }),
    false,
  )
})

test('shouldApplyEmojiLike returns false when message id is missing', () => {
  assert.equal(shouldApplyEmojiLike({
    enabled: true,
    onebotUrl: 'http://127.0.0.1:3000',
    emojiIds: [76],
  }), false)
})

test('shouldApplyEmojiLike returns false when message id is non-numeric', () => {
  assert.equal(shouldApplyEmojiLike({
    enabled: true,
    onebotUrl: 'http://127.0.0.1:3000',
    emojiIds: [76],
    messageId: 'abc',
  }), false)
})

test('selectReminderBot falls back to another active bot', () => {
  const qqBot = {
    platform: 'qq',
    isActive: false,
    sendMessage() {},
  }
  const satoriBot = {
    platform: 'satori',
    isActive: true,
    sendMessage() {},
  }

  assert.equal(selectReminderBot([qqBot, satoriBot]), satoriBot)
})
