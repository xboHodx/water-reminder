import test from 'node:test'
import assert from 'node:assert/strict'

import { buildMessagePool, pickMessage } from '../src/messages'

test('buildMessagePool merges builtin and custom messages in merge mode', () => {
  const pool = buildMessagePool({
    mode: 'merge',
    customMessages: ['喝口水再继续摸鱼。'],
  })
  assert.equal(pool.includes('喝口水再继续摸鱼。'), true)
  assert.ok(pool.length > 1)
})

test('buildMessagePool falls back to builtin messages if custom mode is empty', () => {
  const pool = buildMessagePool({
    mode: 'custom',
    customMessages: [],
  })
  assert.ok(pool.length > 0)
})

test('pickMessage returns a deterministic value for a fixed index', () => {
  assert.equal(pickMessage(['a', 'b', 'c'], 1), 'b')
})
