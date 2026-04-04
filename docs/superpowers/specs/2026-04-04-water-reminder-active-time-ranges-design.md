# Water Reminder Active Time Ranges Design

**Date:** 2026-04-04

**Goal:** Add a daily recurring time-range gate so interval-based reminders only fire during configured time windows, while cron-based reminders keep higher priority and still fire regardless of the window.

## Context

The plugin currently supports three trigger sources:

- `schedule.dailyTimes`
- `schedule.cronExprs`
- `schedule.intervalMinutes`

All triggers eventually call the same `sendReminder()` flow. The only conflict handling today is `behavior.dedupeWindowSeconds`, which suppresses near-duplicate sends after a trigger has already been accepted.

The requested feature adds a scheduling layer between cron triggers and interval triggers:

- Cron and fixed daily time triggers have the highest priority.
- Daily recurring active time ranges are checked before interval reminders are allowed to send.
- Interval reminders have the lowest priority.

## Configuration Design

Add `schedule.activeTimeRanges: string[]` with default `[]`.

Each item uses `HH:mm-HH:mm`, for example:

- `09:00-18:00`
- `09:00-12:00`
- `14:00-18:00`
- `22:00-02:00`

Rules:

- Empty array means no time-range restriction for interval reminders.
- Invalid entries are ignored during normalization.
- Duplicate entries are removed.
- Cross-midnight ranges are supported. `22:00-02:00` means the interval trigger is allowed from 22:00 through 23:59 and from 00:00 through 02:00.

## Priority and Runtime Behavior

Priority order:

1. `dailyTimes` and `cronExprs`
2. `activeTimeRanges`
3. `intervalMinutes`

Runtime rules:

- Triggers created from `dailyTimes` and `cronExprs` bypass active time-range filtering.
- Triggers created from `intervalMinutes` must pass the active time-range check before `sendReminder()` continues.
- If no active time range is configured, interval reminders behave exactly as they do today.
- Existing dedupe still runs after a trigger is accepted, so it continues to prevent close collisions between cron and interval sends.

## Code Changes

### `src/types.ts`

- Extend `ScheduleConfig` with `activeTimeRanges: string[]`.

### `src/config.ts`

- Add normalization helpers for active time ranges.
- Parse `HH:mm-HH:mm` into comparable minute offsets.
- Support cross-midnight ranges.
- Expose a helper that determines whether a given minute-of-day falls within any normalized range.

### `src/index.ts`

- Add the new schema field under `schedule`.
- Normalize `activeTimeRanges` during startup alongside `intervalMinutes`.
- Apply the time-range gate only inside interval trigger callbacks.
- Keep cron-triggered sends unchanged.

### `test/config.spec.ts`

- Add parsing and normalization coverage for valid, invalid, duplicate, and cross-midnight ranges.
- Add behavior tests for "no range configured" and "in-range / out-of-range" checks.

### `readme.md`

- Document `schedule.activeTimeRanges`.
- Clarify the priority rule:
  - cron/fixed-time reminders ignore the window
  - interval reminders are restricted by the window
- Add a configuration example.

## Error Handling

- Invalid active time range strings should not crash plugin startup.
- They should be ignored the same way invalid daily time values are ignored today.
- No existing trigger mode should regress when `activeTimeRanges` is omitted.

## Testing Strategy

Use TDD for the new schedule helpers:

1. Add failing unit tests for normalization and range matching.
2. Implement the minimal normalization and matching code.
3. Add a focused runtime-level test that proves interval filtering can be applied without affecting cron behavior if needed.
4. Update documentation after behavior is covered by tests.

## Out of Scope

- One-off date ranges with specific calendar dates
- Different time windows per group
- Applying active time ranges to cron or fixed daily reminders
- UI-level validation beyond existing schema/string parsing behavior
