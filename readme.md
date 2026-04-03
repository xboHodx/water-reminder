# koishi-plugin-water-reminder

QQ 群喝水提醒插件，支持：

- 指定多个普通 QQ 群
- 每天固定时刻提醒
- Cron 表达式提醒
- 固定间隔提醒
- 内置文案与自定义文案混用
- 本地目录随机图片
- 图片功能独立开关

## 适用范围

- 仅支持普通 QQ 群，即 Koishi QQ 适配器中的 `platform: qq`
- 不支持 QQ 频道
- 不支持 reaction

## 重要说明

### 群 ID 不是传统 QQ 群号

主动发群消息时，要填写 Koishi 里实际使用的群 ID，也就是 QQ 适配器事件中的 `session.guildId` / `session.channelId`，本质上是 `group_openid`。

如果你直接填写传统 QQ 群号，机器人通常发不到对应群。

建议先启用 `inspect`，在目标群发一条消息，读取该群的 `guildId` 或 `channelId` 后再填写配置。

### Cron 依赖

- `intervalMinutes` 不依赖额外插件
- `dailyTimes` 和 `cronExprs` 依赖 `ctx.cron()`

如果当前 Koishi 环境没有启用 cron 服务，插件不会崩溃，但会跳过 `dailyTimes` 和 `cronExprs` 并打印 warning。

## 配置示例

```yml
plugins:
  water-reminder:
    enabledGroups:
      - "abcdefg_group_openid_1"
      - "abcdefg_group_openid_2"
    schedule:
      dailyTimes:
        - "09:30"
        - "14:00"
        - "20:00"
      cronExprs:
        - "0 12 * * 1-5"
      intervalMinutes:
        - 120
    message:
      mode: merge
      customMessages:
        - "喝口水，状态会好很多。"
        - "暂停一下，补充一点水分。"
    image:
      enabled: true
      directory: data/water-reminder-images
      allowedExtensions:
        - jpg
        - jpeg
        - png
        - gif
        - webp
    behavior:
      sendOnStartup: false
      dedupeWindowSeconds: 60
```

## 图片目录

支持递归扫描，例如：

```text
data/water-reminder-images/1.png
data/water-reminder-images/2.jpg
data/water-reminder-images/cute/set-a/3.webp
```

如果图片目录不存在、目录为空或图片扩展名不匹配，插件会自动降级为纯文字提醒。

## 文案策略

- `builtin`: 仅使用内置提醒文案
- `custom`: 仅使用自定义文案；如果为空则退回内置文案
- `merge`: 合并内置文案和自定义文案后随机发送

## 验证建议

1. 先只配置一个测试群。
2. 先关闭图片功能，确认文字提醒能正常发送。
3. 再开启 `image.enabled`，向目录放入几张图片验证随机发图。
4. 最后再启用 `dailyTimes` / `cronExprs`，确认 cron 服务可用。
