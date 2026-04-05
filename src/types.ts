export interface ScheduleConfig {
  dailyTimes: string[]
  cronExprs: string[]
  intervalMinutes: number[]
  activeTimeRanges: string[]
}

export interface MessageConfig {
  mode: 'builtin' | 'custom' | 'merge'
  customMessages: string[]
}

export interface ActiveTimeRange {
  startMinute: number
  endMinute: number
}

export interface ImageConfig {
  enabled: boolean
  directory: string
  allowedExtensions: string[]
}

export interface EmojiLikeConfig {
  enabled: boolean
  onebotUrl: string
  onebotToken?: string
  emojiIds: number[]
  delayMs: number
}

export interface BehaviorConfig {
  sendOnStartup: boolean
  dedupeWindowSeconds: number
}

export interface Config {
  enabledGroups: string[]
  schedule: ScheduleConfig
  message: MessageConfig
  image: ImageConfig
  emojiLike: EmojiLikeConfig
  behavior: BehaviorConfig
}

export interface NormalizedConfig {
  enabledGroups: string[]
  dailyCronExprs: string[]
  cronExprs: string[]
  intervalMinutes: number[]
  activeTimeRanges: ActiveTimeRange[]
  message: MessageConfig
  image: ImageConfig & { allowedExtensions: string[] }
  emojiLike: EmojiLikeConfig
  behavior: BehaviorConfig
}

export interface ReminderPayload {
  text: string
  imagePath?: string
}
