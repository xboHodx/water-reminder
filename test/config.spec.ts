import test from 'node:test'
import assert from 'node:assert/strict'

import { expandDailyTimes, normalizeExtensions, normalizeIntervalMinutes } from '../src/config'

test('expandDailyTimes converts HH:mm values into cron expressions', () => {
  assert.deepEqual(expandDailyTimes(['09:30', '18:05']), ['30 9 * * *', '5 18 * * *'])
})

test('normalizeIntervalMinutes removes invalid and duplicate values', () => {
  assert.deepEqual(normalizeIntervalMinutes([60, 0, -5, 60, 120.5, 15]), [15, 60])
})

test('normalizeExtensions lowercases and prefixes a dot', () => {
  assert.deepEqual(normalizeExtensions(['PNG', '.jpg', 'Gif']), ['.gif', '.jpg', '.png'])
})

test('normalize helpers handle empty inputs safely', () => {
  assert.deepEqual(expandDailyTimes([]), [])
  assert.deepEqual(normalizeIntervalMinutes([]), [])
  assert.deepEqual(normalizeExtensions([]), [])
})
