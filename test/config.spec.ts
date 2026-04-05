import test from 'node:test'
import assert from 'node:assert/strict'

import {
  expandDailyTimes,
  isMinuteInActiveTimeRanges,
  normalizeActiveTimeRanges,
  normalizeExtensions,
  normalizeIntervalMinutes,
} from '../src/config'

test('expandDailyTimes converts HH:mm values into cron expressions', () => {
  assert.deepEqual(expandDailyTimes(['09:30', '18:05']), ['30 9 * * *', '5 18 * * *'])
})

test('normalizeIntervalMinutes removes invalid and duplicate values', () => {
  assert.deepEqual(normalizeIntervalMinutes([60, 0, -5, 60, 120.5, 15]), [15, 60])
})

test('normalizeActiveTimeRanges removes invalid and duplicate values', () => {
  assert.deepEqual(
    normalizeActiveTimeRanges(['09:00-18:00', 'bad', '09:00-18:00', '22:00-02:00']),
    [
      { startMinute: 540, endMinute: 1080 },
      { startMinute: 1320, endMinute: 120 },
    ],
  )
})

test('isMinuteInActiveTimeRanges returns true when no range is configured', () => {
  assert.equal(isMinuteInActiveTimeRanges([], 100), true)
})

test('isMinuteInActiveTimeRanges matches a normal same-day range', () => {
  const ranges = normalizeActiveTimeRanges(['09:00-18:00'])
  assert.equal(isMinuteInActiveTimeRanges(ranges, 8 * 60 + 59), false)
  assert.equal(isMinuteInActiveTimeRanges(ranges, 9 * 60), true)
  assert.equal(isMinuteInActiveTimeRanges(ranges, 18 * 60), true)
  assert.equal(isMinuteInActiveTimeRanges(ranges, 18 * 60 + 1), false)
})

test('isMinuteInActiveTimeRanges matches a cross-midnight range', () => {
  const ranges = normalizeActiveTimeRanges(['22:00-02:00'])
  assert.equal(isMinuteInActiveTimeRanges(ranges, 21 * 60 + 59), false)
  assert.equal(isMinuteInActiveTimeRanges(ranges, 22 * 60), true)
  assert.equal(isMinuteInActiveTimeRanges(ranges, 60), true)
  assert.equal(isMinuteInActiveTimeRanges(ranges, 2 * 60), true)
  assert.equal(isMinuteInActiveTimeRanges(ranges, 2 * 60 + 1), false)
})

test('multiple active time ranges allow multiple windows in one day', () => {
  const ranges = normalizeActiveTimeRanges(['09:00-12:00', '14:00-18:00'])
  assert.equal(isMinuteInActiveTimeRanges(ranges, 13 * 60), false)
  assert.equal(isMinuteInActiveTimeRanges(ranges, 14 * 60), true)
})

test('normalizeExtensions lowercases and prefixes a dot', () => {
  assert.deepEqual(normalizeExtensions(['PNG', '.jpg', 'Gif']), ['.gif', '.jpg', '.png'])
})

test('normalize helpers handle empty inputs safely', () => {
  assert.deepEqual(expandDailyTimes([]), [])
  assert.deepEqual(normalizeActiveTimeRanges([]), [])
  assert.equal(isMinuteInActiveTimeRanges([], 0), true)
  assert.deepEqual(normalizeIntervalMinutes([]), [])
  assert.deepEqual(normalizeExtensions([]), [])
})
