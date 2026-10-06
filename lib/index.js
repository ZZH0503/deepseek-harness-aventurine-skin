/**
 * dsh-aventurine-skin — 宿主半。
 *
 * 职责：为浏览器半提供本插件的静态素材（图片/音频/视频）与语音清单：
 *   GET /aventurine-skin/img/<name>     → assets/img/<name>
 *   GET /aventurine-skin/audio/<name>   → assets/audio/<name>  (支持 Range)
 *   GET /aventurine-skin/video/<name>   → assets/video/<name>  (支持 Range)
 *   GET /aventurine-skin/voice.json     → assets/voice.json    (语音台词清单)
 *
 * 安全性：
 *  - 仅允许与页面同源的请求（Origin 校验）；
 *  - 文件名经严格清洗（仅 [A-Za-z0-9._-]，拒绝路径穿越）；
 *  - 只读，不提供写接口。
 *
 * 素材出处（全部为官方渠道）：
 *  - 立绘/插画：用户提供的米哈游官方美术素材（© COGNOSPHERE / miHoYo）；
 *  - 语音：米哈游官方账号「崩坏星穹铁道」发布的《走近星穹》官方视频台词；
 *  - 动画：同上官方视频中的技能实机演示片段。
 */

import { createReadStream, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { extname, join, basename } from 'node:path'

export const name = 'aventurine-skin'

export const inject = ['webServer']

const ROUTE_PREFIX = '/aventurine-skin'
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.json': 'application/json; charset=utf-8',
}

/** 解析 import.meta.url → 插件根目录（link: 安装时即真实源码目录）。 */
function pluginRoot() {
  return fileURLToPath(new URL('../', import.meta.url))
}

function assetFile(kind, name) {
  // kind ∈ {img, audio, video}；name 已经过 SAFE_NAME 校验，无路径穿越风险。
  return join(pluginRoot(), 'assets', kind, name)
}

function sameOrigin(req) {
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return true
  const host = req.headers.host
  if (typeof host !== 'string' || host === '') return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function send404(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('not found')
}

/** 带 Range 支持的文件响应（视频 seek 必需）。 */
function sendFile(res, filePath, mime) {
  let size
  try {
    size = statSync(filePath).size
  } catch {
    send404(res)
    return
  }
  const range = res.req?.headers?.range
  if (typeof range === 'string' && range.startsWith('bytes=')) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
    if (m) {
      let start = m[1] === '' ? 0 : parseInt(m[1], 10)
      let end = m[2] === '' ? size - 1 : parseInt(m[2], 10)
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < size) {
        end = Math.min(end, size - 1)
        res.writeHead(206, {
          'content-type': mime,
          'content-length': end - start + 1,
          'content-range': `bytes ${start}-${end}/${size}`,
          'accept-ranges': 'bytes',
          'cache-control': 'public, max-age=3600',
        })
        const stream = createReadStream(filePath, { start, end })
        stream.on('error', () => {
          try {
            res.destroy()
          } catch {}
        })
        stream.pipe(res)
        return
      }
    }
    res.writeHead(416, { 'content-range': `bytes */${size}` })
    res.end()
    return
  }
  res.writeHead(200, {
    'content-type': mime,
    'content-length': size,
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=3600',
  })
  const stream = createReadStream(filePath)
  stream.on('error', () => {
    try {
      res.destroy()
    } catch {}
  })
  stream.pipe(res)
}

export function apply(ctx) {
  /* ---------- 任务状态桥（宿主侧权威数据 → 客户端轮询） ----------
   * 监听 agent/status（idle⇄running）判定任务开始/结束，
   * 监听 session/event 累计任务期间的缓存命中统计，
   * 通过 GET /aventurine-skin/status 暴露给浏览器半。
   */
  let runningAgents = 0
  let startedAt = 0
  let cacheRead = 0
  let uncachedInput = 0
  let lastDoneAt = 0
  let lastHitRate = null
  const statusEvents = { seen: 0, running: 0, idle: 0 }

  const onAgentStatus = (payload) => {
    const st = payload && payload.status
    statusEvents.seen += 1
    if (st === 'running') {
      statusEvents.running += 1
      if (runningAgents === 0) {
        startedAt = Date.now()
        cacheRead = 0
        uncachedInput = 0
      }
      runningAgents += 1
    } else if (st === 'idle') {
      statusEvents.idle += 1
      runningAgents = Math.max(0, runningAgents - 1)
      if (runningAgents === 0) {
        lastDoneAt = Date.now()
        const denom = cacheRead + uncachedInput
        lastHitRate = denom > 0 ? cacheRead / denom : null
      }
    }
  }

  const onSessionEvent = (session, event) => {
    try {
      if (runningAgents > 0 && event && event.type === 'assistant/message' && event.data && event.data.usage) {
        cacheRead += Number(event.data.usage.cacheReadTokens) || 0
        uncachedInput += Number(event.data.usage.uncachedInputTokens) || 0
      }
    } catch {}
  }

  let agentStatusUnsub = null
  let sessionEventUnsub = null
  try {
    agentStatusUnsub = ctx.on('agent/status', onAgentStatus)
  } catch {}
  try {
    sessionEventUnsub = ctx.on('session/event', onSessionEvent)
  } catch {}

  ctx.effect(
    () => () => {
      try {
        agentStatusUnsub && agentStatusUnsub()
      } catch {}
      try {
        sessionEventUnsub && sessionEventUnsub()
      } catch {}
    },
    'aventurine-skin: task bridge listeners'
  )

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: (req, res) => {
          if (!sameOrigin(req)) {
            sendJson(res, 403, { error: 'cross-origin request refused' })
            return
          }
          try {
            const pathname = new URL(req.url ?? '/', 'http://dsh.invalid').pathname
            if (!pathname.startsWith(ROUTE_PREFIX + '/')) {
              send404(res)
              return
            }
            const rest = pathname.slice(ROUTE_PREFIX.length + 1)
            const seg = rest.split('/')
            const kind = seg[0]
            const name = seg[1] ?? ''

            if (req.method !== 'GET' && req.method !== 'HEAD') {
              sendJson(res, 405, { error: 'method not allowed' })
              return
            }

            // 语音清单：/aventurine-skin/voice.json
            if (kind === 'voice.json' && name === '') {
              const p = join(pluginRoot(), 'assets', 'voice.json')
              if (!existsSync(p)) {
                sendJson(res, 404, { error: 'voice manifest missing' })
                return
              }
              const mime = MIME['.json']
              sendFile(res, p, mime)
              return
            }

            // 任务状态桥：/aventurine-skin/status
            if (kind === 'status' && name === '') {
              sendJson(res, 200, {
                running: runningAgents > 0,
                runningAgents,
                startedAt,
                lastDoneAt,
                lastHitRate,
                statusEvents,
              })
              return
            }

            if (kind !== 'img' && kind !== 'audio' && kind !== 'video') {
              send404(res)
              return
            }
            if (!SAFE_NAME.test(name)) {
              send404(res)
              return
            }
            const file = assetFile(kind, name)
            if (!file.startsWith(pluginRoot())) {
              send404(res)
              return
            }
            if (!existsSync(file)) {
              send404(res)
              return
            }
            const mime = MIME[extname(name).toLowerCase()]
            if (!mime) {
              send404(res)
              return
            }
            if (req.method === 'HEAD') {
              res.writeHead(200, { 'content-type': mime, 'content-length': statSync(file).size })
              res.end()
              return
            }
            sendFile(res, file, mime)
          } catch (error) {
            ctx.logger?.warn?.(error)
            try {
              sendJson(res, 500, { error: 'internal error' })
            } catch {}
          }
        },
      }),
    'aventurine-skin: asset routes'
  )
}
