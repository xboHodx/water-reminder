import { Context, Schema, h } from 'koishi'
import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { DEFAULT_IMAGE_EXTENSIONS } from './constants'
import { expandDailyTimes, normalizeExtensions, normalizeIntervalMinutes } from './config'
import { collectImageFiles, filterImageFiles, getImageMimeType } from './images'
import { buildMessagePool, pickMessage } from './messages'
import {
  buildCronJobs,
  buildEmojiLikeHeaders,
  buildEmojiLikeRequest,
  buildPayload,
  extractMessageIds,
  getEmojiLikeFailure,
  selectReminderBot,
  shouldApplyEmojiLike,
  shouldSkipByDedupe,
} from './runtime'
import type { Config as WaterReminderConfig } from './types'

type CronContext = Context & {
  cron?: (expr: string, callback: () => void | Promise<void>) => (() => void) | void
}

export const name = 'water-reminder'

export const Config: Schema<WaterReminderConfig> = Schema.object({
  enabledGroups: Schema.array(Schema.string().required())
    .description('需要提醒的 QQ 群 ID 列表，使用 Koishi inspect 里看到的 guildId/channelId。')
    .default([]),
  schedule: Schema.object({
    dailyTimes: Schema.array(Schema.string().required())
      .description('每天固定提醒时刻，格式为 HH:mm。')
      .default([]),
    cronExprs: Schema.array(Schema.string().required())
      .description('额外的 Cron 表达式。')
      .default([]),
    intervalMinutes: Schema.array(Schema.number().required())
      .description('按固定分钟间隔提醒。')
      .default([]),
  }).description('定时触发配置。'),
  message: Schema.object({
    mode: Schema.union(['builtin', 'custom', 'merge'])
      .description('提醒文案来源。')
      .default('merge'),
    customMessages: Schema.array(Schema.string().required())
      .description('自定义提醒文案。')
      .default([]),
  }).description('提醒文案配置。'),
  image: Schema.object({
    enabled: Schema.boolean()
      .description('是否启用随机图片。')
      .default(false),
    directory: Schema.string()
      .description('随机图片目录，相对路径会以 koishi-app 运行目录解析。')
      .default('data/water-reminder-images'),
    allowedExtensions: Schema.array(Schema.string().required())
      .description('允许发送的图片扩展名。')
      .default(DEFAULT_IMAGE_EXTENSIONS),
  }).description('随机图片配置。'),
  emojiLike: Schema.object({
    enabled: Schema.boolean()
      .description('是否在提醒消息发送后自动贴表情。')
      .default(false),
    onebotUrl: Schema.string()
      .description('OneBot HTTP 地址，例如 http://127.0.0.1:3000。')
      .default('http://127.0.0.1:3000'),
    onebotToken: Schema.string()
      .description('OneBot HTTP Token。')
      .default(''),
    emojiIds: Schema.array(Schema.number().required())
      .description('要贴上的 emoji_id 列表。')
      .default([]),
    delayMs: Schema.number()
      .description('发送成功后等待多少毫秒再开始贴表情。')
      .default(300),
  }).description('消息贴表情配置。'),
  behavior: Schema.object({
    sendOnStartup: Schema.boolean()
      .description('启动后是否立即发送一次提醒。')
      .default(false),
    dedupeWindowSeconds: Schema.number()
      .description('不同触发器撞车时的去重窗口，单位秒。')
      .default(60),
  }).description('运行行为配置。'),
})

function buildWindowKey(now: number, windowSeconds: number) {
  const size = Math.max(windowSeconds, 1) * 1000
  return String(Math.floor(now / size))
}

async function buildMessageContent(payload: ReturnType<typeof buildPayload>) {
  if (!payload.imagePath) return payload.text
  const buffer = await readFile(payload.imagePath)
  return h('message', h.image(buffer, getImageMimeType(payload.imagePath)), payload.text)
}

export function apply(ctx: Context, config: WaterReminderConfig) {
  const logger = ctx.logger(name)
  const cronCtx = ctx as CronContext
  const dedupeCache = new Map<string, number>()
  const groups = [...new Set(config.enabledGroups.map((item) => item.trim()).filter(Boolean))]
  const dailyCronExprs = expandDailyTimes(config.schedule.dailyTimes)
  const cronExprs = buildCronJobs(dailyCronExprs, config.schedule.cronExprs.map((item) => item.trim()).filter(Boolean))
  const intervalMinutes = normalizeIntervalMinutes(config.schedule.intervalMinutes)
  const allowedExtensions = normalizeExtensions(config.image.allowedExtensions)
  const messagePool = buildMessagePool(config.message)
  const imageDirectory = resolve(config.image.directory)
  let imageFiles: string[] = []

  async function refreshImageFiles() {
    if (!config.image.enabled) {
      imageFiles = []
      return
    }

    try {
      await access(imageDirectory)
      imageFiles = filterImageFiles(await collectImageFiles(imageDirectory), allowedExtensions)
      logger.info(`loaded ${imageFiles.length} reminder images from ${imageDirectory}`)
    } catch (error) {
      imageFiles = []
      logger.warn(`failed to read image directory ${imageDirectory}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function sendReminder(triggerLabel: string) {
    if (!groups.length) {
      logger.warn('skip reminder because no enabledGroups are configured')
      return
    }

    const bot = selectReminderBot(ctx.bots)
    if (!bot) {
      logger.warn(`skip ${triggerLabel} reminder because no active bot with sendMessage() is available`)
      return
    }

    const now = Date.now()
    const key = buildWindowKey(now, config.behavior.dedupeWindowSeconds)
    if (shouldSkipByDedupe(dedupeCache, key, now, config.behavior.dedupeWindowSeconds)) {
      logger.debug(`skip duplicated reminder for trigger ${triggerLabel}`)
      return
    }

    const text = pickMessage(messagePool)
    const imagePath = imageFiles.length
      ? imageFiles[Math.floor(Math.random() * imageFiles.length)]
      : undefined
    const payload = buildPayload(text, imagePath)
    for (const groupId of groups) {
      let sendResult: unknown

      try {
        const content = await buildMessageContent(payload)
        sendResult = await bot.sendMessage(groupId, content)
      } catch (error) {
        logger.warn(`failed to send ${triggerLabel} reminder to ${groupId}: ${error instanceof Error ? error.message : String(error)}`)
        continue
      }

      const messageIds = extractMessageIds(sendResult).filter((messageId) => shouldApplyEmojiLike({
        enabled: config.emojiLike.enabled,
        onebotUrl: config.emojiLike.onebotUrl,
        emojiIds: config.emojiLike.emojiIds,
        messageId,
      }))

      if (!messageIds.length) {
        continue
      }

      try {
        if (config.emojiLike.delayMs > 0) {
          await ctx.sleep(config.emojiLike.delayMs)
        }

        const onebotUrl = `${config.emojiLike.onebotUrl.replace(/\/$/, '')}/set_msg_emoji_like`
        const headers = buildEmojiLikeHeaders(config.emojiLike.onebotToken || undefined)
        for (const messageId of messageIds) {
          for (const emojiId of config.emojiLike.emojiIds) {
            try {
              const response = await ctx.http.post(
                onebotUrl,
                buildEmojiLikeRequest(messageId, emojiId),
                { headers },
              )
              const failure = getEmojiLikeFailure(response)
              if (failure) {
                logger.warn(`failed to apply emoji like ${emojiId} for ${triggerLabel} message ${messageId} to ${groupId}: ${failure}`)
                continue
              }
              logger.info(`applied emoji like ${emojiId} for ${triggerLabel} message ${messageId} to ${groupId}`)
            } catch (error) {
              logger.warn(`failed to apply emoji like ${emojiId} for ${triggerLabel} message ${messageId} to ${groupId}: ${error instanceof Error ? error.message : String(error)}`)
            }
          }
        }
      } catch (error) {
        logger.warn(`failed to apply emoji like for ${triggerLabel} message(s) ${messageIds.join(', ')} to ${groupId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  ctx.on('ready', async () => {
    await refreshImageFiles()

    if (cronExprs.length && !cronCtx.cron) {
      logger.warn('cron schedules are configured but ctx.cron() is unavailable; install and enable koishi-plugin-cron to use dailyTimes and cronExprs')
    }

    for (const expr of cronExprs) {
      if (!cronCtx.cron) break
      try {
        cronCtx.cron(expr, () => sendReminder(`cron:${expr}`))
      } catch (error) {
        logger.warn(`skip invalid cron expression "${expr}": ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    for (const interval of intervalMinutes) {
      ctx.setInterval(() => {
        void sendReminder(`interval:${interval}`)
      }, interval * 60 * 1000)
    }

    if (config.behavior.sendOnStartup) {
      await sendReminder('startup')
    }
  })
}
