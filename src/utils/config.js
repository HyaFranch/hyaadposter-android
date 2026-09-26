const CONFIG_KEY = 'hyaadposter_config_v2'

export const DEFAULT_CONFIG = {
  accounts: {},
  active_account: '',
  webhook_enabled: false,
  webhook_url: '',
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return structuredClone(DEFAULT_CONFIG)
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return structuredClone(DEFAULT_CONFIG)
  }
}

export function saveConfig(cfg) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
  } catch (e) {
    console.error('Failed to save config:', e)
  }
}

export function protectCookie(plain) {
  if (!plain) return ''
  return 'b64:' + btoa(unescape(encodeURIComponent(plain)))
}

export function unprotectCookie(protected_) {
  if (!protected_) return ''
  if (protected_.startsWith('b64:')) {
    try { return decodeURIComponent(escape(atob(protected_.slice(4)))) }
    catch { return '' }
  }

  return protected_.startsWith('dpapi:') ? '' : protected_
}

export async function unprotectCookieAsync(protected_) {
  return unprotectCookie(protected_)
}

export function extractCookieValue(pasted) {
  pasted = pasted.trim()
  const cookieName = '_RoliVerification'
  for (const chunk of pasted.split(';')) {
    const c = chunk.trim()
    if (c.startsWith(`${cookieName}=`)) return c.split('=', 2)[1].trim()
  }
  return pasted.split(';')[0].trim()
}
