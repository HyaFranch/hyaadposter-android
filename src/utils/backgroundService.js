import { registerPlugin } from '@capacitor/core'

const BotServicePlugin = registerPlugin('BotService', {
  web: {
    startService: async () => ({ started: false }),
    stopService:  async () => ({ stopped: false }),
    isIgnoringBatteryOptimizations: async () => ({ ignoring: true }),
    requestIgnoreBatteryOptimizations: async () => ({}),
  },
})

export async function startBotService() {
  try { await BotServicePlugin.startService() }
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
