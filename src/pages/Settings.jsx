import { useState, useEffect, useRef } from 'react'
import { useNativePaste } from '../hooks/useNativePaste'
import {
  Webhook, Bell, Info, ExternalLink, Github, Send,
  BatteryCharging, Shield, CheckCircle2,
  RefreshCw, Download, ArrowUpCircle, AlertTriangle,
} from 'lucide-react'
import { useApp }   from '../hooks/useAppState'
import { Button, Card, PageHeader, Toggle, Input, Alert } from '../components/ui'
import { notifyWebhook } from '../utils/api'
import { isIgnoringBatteryOptimizations, requestIgnoreBatteryOptimizations } from '../utils/backgroundService'
import { checkForUpdate, downloadAndInstall, APP_VERSION } from '../utils/updater'
import { registerPlugin } from '@capacitor/core'

const InstallerPlugin = registerPlugin('Installer', { web: {} })

function detectManufacturer() {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('samsung') || ua.includes('sm-'))   return 'samsung'
  if (ua.includes('miui') || ua.includes('xiaomi'))   return 'xiaomi'
  if (ua.includes('oneplus') || ua.includes('op '))   return 'oneplus'
  if (ua.includes('huawei') || ua.includes('hms'))    return 'huawei'
  if (ua.includes('oppo') || ua.includes('coloros'))  return 'oppo'
  if (ua.includes('vivo') || ua.includes('funtouch')) return 'vivo'
  return 'generic'
}

const BATTERY_GUIDE = {
  samsung: { name: 'Samsung', steps: [
    'Configurações → Aplicativos → HyaAdPoster → Bateria',
    'Selecione "Sem restrições"',
  ]},
  xiaomi: { name: 'Xiaomi / MIUI', steps: [
    'Configurações → Apps → Gerenciar apps → HyaAdPoster → Autostart → Ativar',
    'No mesmo menu → Battery saver → "No restrictions"',
    'Recentes → segure o card do app → toque no 🔒 para travar',
  ]},
  oneplus: { name: 'OnePlus', steps: [
    'Configurações → Bateria → Gerenciamento de bateria → HyaAdPoster',
    'Selecione "Sem restrições"',
  ]},
  huawei: { name: 'Huawei / EMUI', steps: [
    'Configurações → Aplicativos → HyaAdPoster → Bateria → desative "Gerenciamento de energia"',
    'Configurações → Bateria → Inicialização de aplicativos → desative gerenciamento automático',
  ]},
  oppo: { name: 'OPPO / ColorOS', steps: [
    'Gerenciamento de aplicativos → HyaAdPoster → Uso de bateria',
    'Selecione "Não otimizar"',
  ]},
  vivo: { name: 'vivo', steps: [
    'Configurações → Bateria → Alto consumo em segundo plano',
    'Adicione HyaAdPoster à lista de permitidos',
  ]},
  generic: { name: 'Android', steps: [
    'O botão acima deve abrir a tela correta do sistema',
    'Procure "Não otimizar" ou "Sem restrições" para HyaAdPoster e aceite',
  ]},
}

export default function Settings() {
  const { cfg, setCfg } = useApp()
  const [webhookUrl,    setWebhookUrl]    = useState(cfg.webhook_url)
  const [saved,         setSaved]         = useState(false)
  const [testStatus,    setTestStatus]    = useState(null)
  const [batteryIgnoring,    setBatteryIgnoring]    = useState(null)
  const [batteryRequesting,  setBatteryRequesting]  = useState(false)

  const [updateInfo,     setUpdateInfo]     = useState(null)
  const [updateStatus,   setUpdateStatus]   = useState('idle')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateError,    setUpdateError]    = useState('')
  const listenerRef = useRef(null)

  const webhookNativeRef = useNativePaste(val => {
    setWebhookUrl(val)
    setSaved(false)
  })

  const guide = BATTERY_GUIDE[detectManufacturer()] ?? BATTERY_GUIDE.generic

  useEffect(() => {
    isIgnoringBatteryOptimizations().then(v => setBatteryIgnoring(v))
  }, [])

  const handleRequestBattery = async () => {
    setBatteryRequesting(true)
    await requestIgnoreBatteryOptimizations()
    setTimeout(async () => {
      setBatteryIgnoring(await isIgnoringBatteryOptimizations())
      setBatteryRequesting(false)
    }, 2000)
  }

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking')
    setUpdateError('')
    setUpdateInfo(null)
    try {
      const info = await checkForUpdate()
      if (info?.hasUpdate) {
        setUpdateInfo(info)
        setUpdateStatus('available')
      } else {
        setUpdateStatus('upToDate')

        setTimeout(() => setUpdateStatus('idle'), 4000)
      }
    } catch (e) {
      setUpdateStatus('error')
      setUpdateError(e?.message ?? 'Erro ao checar atualização')
    }
  }

  const handleDownloadInstall = async () => {
    if (!updateInfo?.downloadUrl) return
    setUpdateStatus('downloading')
    setDownloadProgress(0)

    listenerRef.current = await InstallerPlugin.addListener('downloadProgress', ({ progress }) => {
      setDownloadProgress(progress ?? 0)
      if (progress >= 100) setUpdateStatus('installing')
    })

    const result = await downloadAndInstall(updateInfo.downloadUrl)

    listenerRef.current?.remove()
    listenerRef.current = null

    if (!result.ok) {
      setUpdateStatus('error')
      setUpdateError(result.error ?? 'Falha no download')
    }

  }

  const handleSave = () => {
    setCfg(prev => ({ ...prev, webhook_url: webhookUrl.trim() }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTestWebhook = async () => {
    const url = webhookUrl.trim()
    if (!url.startsWith('https://discord.com/api/webhooks/')) {
      setTestStatus('error'); setTimeout(() => setTestStatus(null), 3000); return
    }
    setTestStatus('sending')
    try {
      await notifyWebhook(url, {
        title: '✅ HyaAdPoster — Webhook test', color: 0x3d7eff,
        description: 'Your Discord webhook is working correctly.',
        footer: { text: `HyaAdPoster ${APP_VERSION} (Android)` },
        timestamp: new Date().toISOString(),
      })
      setTestStatus('ok')
    } catch { setTestStatus('error') }
    setTimeout(() => setTestStatus(null), 3000)
  }

  return (
    <div className="animate-fadein">
      <PageHeader title="Settings" subtitle="Configure notifications and app behaviour" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ArrowUpCircle size={15} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Atualizações</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {APP_VERSION}
            </span>
          </div>

          {}
          {updateStatus === 'available' && updateInfo && (
            <div style={{
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 12,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                Nova versão disponível: {updateInfo.version}
              </div>
              {updateInfo.releaseNotes ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, maxHeight: 80, overflow: 'auto' }}>
                  {updateInfo.releaseNotes.slice(0, 300)}{updateInfo.releaseNotes.length > 300 ? '…' : ''}
                </div>
              ) : null}
              {updateInfo.size ? (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                  Tamanho: {(updateInfo.size / 1024 / 1024).toFixed(1)} MB
                </div>
              ) : null}
            </div>
          )}

          {updateStatus === 'upToDate' && (
            <Alert variant="success" style={{ marginBottom: 12 }}>
              <CheckCircle2 size={13} style={{ marginRight: 6 }} />
              Você já está na versão mais recente ({APP_VERSION})
            </Alert>
          )}

          {updateStatus === 'error' && (
            <Alert variant="danger" style={{ marginBottom: 12 }}>
              <AlertTriangle size={13} style={{ marginRight: 6 }} />
              {updateError || 'Erro ao verificar atualizações'}
            </Alert>
          )}

          {}
          {(updateStatus === 'downloading' || updateStatus === 'installing') && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {updateStatus === 'installing' ? 'Abrindo instalador…' : `Baixando… ${downloadProgress}%`}
                </span>
                <span style={{ fontSize: 12, color: 'var(--accent)' }}>{downloadProgress}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: 'var(--accent)',
                  width: `${downloadProgress}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              {updateStatus === 'installing' && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                  Aceite a instalação na tela do sistema. O app será reiniciado automaticamente.
                </div>
              )}
            </div>
          )}

          {}
          <div style={{ display: 'flex', gap: 8 }}>
            {updateStatus !== 'available' && updateStatus !== 'downloading' && updateStatus !== 'installing' && (
              <Button
                variant="secondary"
                size="sm"
                style={{ minHeight: 40 }}
                icon={<RefreshCw size={13} className={updateStatus === 'checking' ? 'animate-spin' : ''} />}
                loading={updateStatus === 'checking'}
                onClick={handleCheckUpdate}
              >
                {updateStatus === 'checking' ? 'Verificando…' : 'Verificar atualização'}
              </Button>
            )}

            {updateStatus === 'available' && (
              <Button
                variant="primary"
                size="sm"
                style={{ flex: 1, minHeight: 40 }}
                icon={<Download size={13} />}
                onClick={handleDownloadInstall}
              >
                Baixar e instalar {updateInfo?.version}
              </Button>
            )}
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
            Na primeira atualização, o Android vai pedir para habilitar "Instalar de fontes desconhecidas" para o HyaAdPoster — basta aceitar.
          </div>
        </Card>

        {}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BatteryCharging size={15} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Background &amp; Bateria</span>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            Necessário para o bot continuar postando com a tela desligada ou app minimizado.
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 'var(--r)',
            background: 'var(--surface-2)', border: '1px solid var(--border)', marginBottom: 12,
          }}>
            {batteryIgnoring === null && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Verificando…</span>}
            {batteryIgnoring === true  && <><CheckCircle2 size={16} color="var(--success)" /><span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>Otimização desativada ✓</span></>}
            {batteryIgnoring === false && <><Shield size={16} color="var(--warning)" /><span style={{ fontSize: 13, color: 'var(--warning)' }}>Otimização ativa — bot pode ser interrompido</span></>}
          </div>

          {batteryIgnoring === false && (
            <Button variant="primary" style={{ width: '100%', minHeight: 48, marginBottom: 12 }}
              icon={<BatteryCharging size={15} />} loading={batteryRequesting} onClick={handleRequestBattery}>
              Desativar otimização de bateria
            </Button>
          )}

          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r)', padding: '12px 14px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Guia para {guide.name}
            </div>
            <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {guide.steps.map((step, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
          </div>
        </Card>

        {}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Webhook size={15} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Discord Notifications</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Toggle checked={cfg.webhook_enabled} onChange={val => setCfg(prev => ({ ...prev, webhook_enabled: val }))}
              label="Enable Discord webhook" description="Sends a message to Discord when ads are posted or fail" />
            <Input
              ref={webhookNativeRef}
              label="Webhook URL"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              disabled={!cfg.webhook_enabled}
            />
            {cfg.webhook_enabled && !webhookUrl.trim().startsWith('https://discord.com/api/webhooks/') && (
              <Alert variant="warning">Paste a valid Discord webhook URL.</Alert>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={handleSave} variant={saved ? 'success' : 'primary'} size="sm">
                {saved ? '✓ Saved' : 'Save'}
              </Button>
              <Button onClick={handleTestWebhook} variant="secondary" size="sm" icon={<Send size={12} />}
                disabled={!cfg.webhook_enabled || !webhookUrl.trim() || testStatus === 'sending'}
                loading={testStatus === 'sending'}>
                {testStatus === 'ok' ? '✓ Sent!' : testStatus === 'error' ? '✕ Failed' : 'Test'}
              </Button>
            </div>
          </div>
        </Card>

        {}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Info size={15} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>About HyaAdPoster</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div><strong style={{ color: 'var(--text)' }}>HyaAdPoster {APP_VERSION} (Android)</strong> — Automated trade ad poster for Rolimons.</div>
            <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--warning)' }}>⚠ Disclaimer:</span> Use responsibly. Never share your cookie.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <Button variant="secondary" size="sm" icon={<Github size={13} />}
                onClick={() => window.open('https://github.com/HyaFranch/hyaadposter', '_blank')}>GitHub</Button>
              <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}
                onClick={() => window.open('https://www.rolimons.com', '_blank')}>Rolimons</Button>
            </div>
          </div>
        </Card>

        {}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Bell size={15} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Timing &amp; Limits</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Post interval',   value: '15 minutes' },
              { label: 'Max tags per ad', value: '4' },
              { label: 'Max offer items', value: '4 (Rolimons limit)' },
              { label: 'Daily ad limit',  value: 'Set by Rolimons' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{value}</span>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  )
}
