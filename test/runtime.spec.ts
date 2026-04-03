import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCronJobs, buildPayload, selectReminderBot, shouldSkipByDedupe } from '../src/runtime'

test('buildCronJobs merges dailyTimes-derived cron values and raw cron expressions', () => {
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

test('selectReminderBot prefers qq but falls back to another active bot', () => {
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
