import { registerPlugin } from '@capacitor/core'

const BotServicePlugin = registerPlugin('BotService', {
  web: {
    startService: async () => ({ started: false }),
    stopService:  async () => ({ stopped: false }),
    isIgnoringBatteryOptimizations: async () => ({ ignoring: true }),
    requestIgnoreBatteryOptimizations: async () => ({}),
    addListener: async () => ({ remove: () => {} }),
    getStatus: async () => ({ status: 'idle' }),
  },
})

// payload: { username, cookie, profileName, webhookUrl, postIntervalMs, queue }
// No Android o loop inteiro de postagem passa a rodar dentro do
// BotForegroundService nativo (Java), não mais em JS na WebView — por
// isso continua postando com o app minimizado/em segundo plano.
export async function startBotService(payload) {
  try { await BotServicePlugin.startService(payload) }
  catch (e) { console.warn('[BotService] startService:', e?.message) }
}

export async function stopBotService() {
  try { await BotServicePlugin.stopService() }
  catch (e) { console.warn('[BotService] stopService:', e?.message) }
}

export async function isIgnoringBatteryOptimizations() {
  try {
    const { ignoring } = await BotServicePlugin.isIgnoringBatteryOptimizations()
    return !!ignoring
  } catch { return false }
}

export async function requestIgnoreBatteryOptimizations() {
  try { await BotServicePlugin.requestIgnoreBatteryOptimizations() }
  catch (e) { console.warn('[BotService] requestBattery:', e?.message) }
}

// onLog: ({ level, text }) => void — dispara pra cada linha de log que o
// service nativo emite (mesmo cenário de app aberto ou em background).
export function onBotLog(callback) {
  const handle = BotServicePlugin.addListener('botLog', callback)
  return () => handle.then(h => h.remove()).catch(() => {})
}

// onStatus: ({ status }) => void — 'running' | 'idle' | 'expired' | 'stopping'
export function onBotStatus(callback) {
  const handle = BotServicePlugin.addListener('botStatus', callback)
  return () => handle.then(h => h.remove()).catch(() => {})
}

// Consulta o status atual do service nativo — usado ao reabrir o app pra
// sincronizar a UI caso o bot já esteja rodando em segundo plano.
export async function getBotServiceStatus() {
  try {
    const { status } = await BotServicePlugin.getStatus()
    return status ?? 'idle'
  } catch { return 'idle' }
}
