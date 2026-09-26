import { CapacitorHttp } from '@capacitor/core'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'
export const COOKIE_NAME = '_RoliVerification'
export const POST_INTERVAL_MS = 15 * 60 * 1000

export class RobloxAPIError extends Error {}
export class CookieExpiredError extends Error {}

export async function resolveUserId(username) {
  const res = await CapacitorHttp.post({
    url: 'https://users.roblox.com/v1/usernames/users',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    data: { usernames: [username], excludeBannedUsers: true },
  })
  if (res.status !== 200) throw new RobloxAPIError(`HTTP ${res.status}`)
  const data = res.data?.data
  if (!data?.length) throw new RobloxAPIError(`User '${username}' not found`)
  return { id: data[0].id, name: data[0].name }
}

export async function getUserAvatarUrl(userId) {
  try {
    const res = await CapacitorHttp.get({
      url: `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
      headers: { 'User-Agent': UA },
    })
    return res.data?.data?.[0]?.imageUrl ?? ''
  } catch {
    return ''
  }
}

export async function getInventory(userId) {
  const items = []
  let cursor = ''
  while (true) {
    const url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?sortOrder=Asc&limit=100&cursor=${cursor}`
    const res = await CapacitorHttp.get({ url, headers: { 'User-Agent': UA } })
    if (res.status === 403) throw new RobloxAPIError('Inventory is private — make it public in Roblox settings')
    if (res.status !== 200) throw new RobloxAPIError(`HTTP ${res.status}`)
    const body = res.data
    items.push(...(body?.data ?? []))
    cursor = body?.nextPageCursor
    if (!cursor) break
  }
  return items
}

export async function fetchItemThumbnails(assetIds, size = '50x50') {
  const urls = {}
  const ids = [...new Set(assetIds.filter(Boolean))]
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    try {
      const res = await CapacitorHttp.get({
        url: `https://thumbnails.roblox.com/v1/assets?assetIds=${chunk.join(',')}&size=${size}&format=Png&isCircular=false`,
        headers: { 'User-Agent': UA },
      })
      for (const entry of res.data?.data ?? []) {
        if (entry.imageUrl && entry.targetId != null) urls[entry.targetId] = entry.imageUrl
      }
    } catch {  }
  }
  return urls
}

const ITEM_CACHE_KEY = 'hyaadposter_itemcache_v1'
const CACHE_TTL_MS = 30 * 60 * 1000

export async function fetchItemMarketData() {

  try {
    const raw = localStorage.getItem(ITEM_CACHE_KEY)
    if (raw) {
      const { fetchedAt, items } = JSON.parse(raw)
      if (Date.now() - fetchedAt < CACHE_TTL_MS) return { items, fresh: false }
    }
  } catch {  }

  const endpoints = [
    { url: 'https://api.rolimons.com/items/v2/itemdetails', rapI: 2, valI: 4, demI: 5 },
    { url: 'https://www.rolimons.com/itemapi/itemdetails',  rapI: 2, valI: 3, demI: 5 },
  ]

  for (const { url, rapI, valI, demI } of endpoints) {
    try {
      const res = await CapacitorHttp.get({ url, headers: { Accept: 'application/json' } })
      if (res.status !== 200) continue
      const raw = res.data?.items ?? {}
      if (!Object.keys(raw).length) continue
      const items = {}
      for (const [id, f] of Object.entries(raw)) {
        items[Number(id)] = {
          name:    f[0] ?? '',
          acronym: f[1] ?? '',
          rap:     f[rapI] ?? 0,
          value:   f[valI] ?? -1,
          demand:  f[demI] ?? -1,
        }
      }
      localStorage.setItem(ITEM_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), items }))
      return { items, fresh: true }
    } catch {  }
  }

  return { items: {}, fresh: false }
}

export function groupInventory(rawItems, marketData = {}) {
  const grouped = {}
  for (const entry of rawItems) {
    const id = entry.assetId
    if (!grouped[id]) {
      grouped[id] = {
        assetId:  id,
        name:     entry.name ?? `Item ${id}`,
        rap:      entry.recentAveragePrice ?? 0,
        value:    marketData[id]?.value ?? -1,
        quantity: 0,
      }
    }
    grouped[id].quantity++
  }
  return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name))
}

export async function postAd(userId, cookie, offerItemIds, tags, requestItemIds = []) {
  let res
  try {
    res = await CapacitorHttp.post({
      url: 'https://api.rolimons.com/tradeads/v1/createad',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `${COOKIE_NAME}=${cookie}`,
        'User-Agent': UA,
      },
      data: {
        player_id:        userId,
        offer_item_ids:   offerItemIds,
        request_item_ids: requestItemIds,
        request_tags:     tags,
      },
    })
  } catch (e) {
    return { ok: false, message: `Connection error: ${e.message}` }
  }

  if (res.status === 401 || res.status === 403) throw new CookieExpiredError(`HTTP ${res.status}`)

  const parsed = res.data ?? {}
  const msg = String(parsed.message ?? '')

  if (/not verified|not authenticated|invalid session|log in/i.test(msg)) throw new CookieExpiredError(msg)
  if (msg === 'Ad creation cooldown has not elapsed') return { ok: false, message: 'Cooldown has not elapsed yet' }
  if (res.status !== 201) return { ok: false, message: `HTTP ${res.status}: ${JSON.stringify(parsed).slice(0, 200)}` }

  return { ok: true, message: 'Ad posted successfully' }
}

export async function notifyWebhook(webhookUrl, embed) {
  if (!webhookUrl) return
  try {
    await CapacitorHttp.post({
      url: webhookUrl,
      headers: { 'Content-Type': 'application/json' },
      data: { embeds: [embed] },
    })
  } catch {  }
}

export function formatNumber(n) {
  try { return Number(Math.round(Number(n))).toLocaleString('pt-BR') }
  catch { return String(n) }
}
