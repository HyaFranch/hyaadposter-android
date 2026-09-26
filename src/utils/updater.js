import { CapacitorHttp } from '@capacitor/core'
import { registerPlugin } from '@capacitor/core'

const GITHUB_REPO    = 'HyaFranch/hyaadposter-android'
// Injetada pela CI a partir da tag git no momento do build (ex. tag
// "v2.2.2" → VITE_APP_VERSION="2.2.2"). Em dev local, sem a env var, cai
// no fallback abaixo — só ajuste esse fallback se rodar o updater fora
// de um build de CI e precisar testar a comparação de versões.
const APP_VERSION    = 'v' + (import.meta.env.VITE_APP_VERSION || '2.2.0')
const APK_ASSET_NAME = 'app-release.apk'

const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

const InstallerPlugin = registerPlugin('Installer', {
  web: {
    downloadAndInstall: async () => ({ error: 'Not supported in browser' }),
  },
})

export async function checkForUpdate() {
  try {
    const res = await CapacitorHttp.get({
      url: RELEASES_URL,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'HyaAdPoster-Android',
      },
    })

    if (res.status !== 200) return null

    const release = res.data
    const latestVersion = release.tag_name

    if (!latestVersion) return null

    if (!isNewer(latestVersion, APP_VERSION)) return null

    const apkAsset = (release.assets ?? []).find(a =>
      a.name === APK_ASSET_NAME || a.name.endsWith('.apk')
    )
    if (!apkAsset) return null

    return {
      hasUpdate:     true,
      version:       latestVersion,
      currentVersion: APP_VERSION,
      downloadUrl:   apkAsset.browser_download_url,
      size:          apkAsset.size,
      releaseNotes:  release.body ?? '',
      publishedAt:   release.published_at ?? '',
    }
  } catch (e) {
    console.warn('[Updater] checkForUpdate error:', e?.message)
    return null
  }
}

export async function downloadAndInstall(downloadUrl, onProgress) {
  try {
    const result = await InstallerPlugin.downloadAndInstall({
      url: downloadUrl,
      fileName: APK_ASSET_NAME,
    })
    if (result?.error) throw new Error(result.error)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message ?? 'Unknown error' }
  }
}

function parseVersion(v) {
  return (v ?? '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0)
}

function isNewer(latest, current) {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff > 0) return true
    if (diff < 0) return false
  }
  return false
}

export { APP_VERSION }
