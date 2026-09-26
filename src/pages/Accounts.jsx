import { useState, useRef } from 'react'
import { useNativePaste } from '../hooks/useNativePaste'
import { Plus, User, Trash2, RefreshCw, LogIn, Users, ShieldCheck, AlertTriangle } from 'lucide-react'
import { useApp } from '../hooks/useAppState'
import { Button, Card, PageHeader, Badge, Modal, Input, Alert, EmptyState } from '../components/ui'
import { extractCookieValue, unprotectCookie } from '../utils/config'
import { Capacitor, registerPlugin } from '@capacitor/core'

const isElectron  = !!window.electronAPI?.auth
const isCapacitor = Capacitor.isNativePlatform()
const hasAutoLogin = isElectron || isCapacitor

const CookieCapture = isCapacitor ? registerPlugin('CookieCapture') : null

export default function Accounts() {
  const { cfg, addAccount, updateAccountCookie, removeAccount, setActiveAccount } = useApp()
  const [showAdd, setShowAdd]           = useState(false)
  const [reverifying, setReverifying]   = useState(null)

  const accounts = Object.entries(cfg.accounts)

  return (
    <div className="animate-fadein">
      <PageHeader
        title="Accounts"
        subtitle="Manage your Roblox/Rolimons accounts"
        action={<Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Account</Button>}
      />

      <Alert variant="info" style={{ marginBottom: 20 }}>
        Your cookie is stored locally and never leaves your device. It is only used to post ads on Rolimons.
      </Alert>

      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No accounts added"
            description={
              hasAutoLogin
                ? 'Click "Add Account", then sign in to Rolimons — the app captures the cookie automatically.'
                : 'Add your Roblox account to get started.'
            }
            action={<Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Account</Button>}
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {accounts.map(([id, acc]) => {
            const isActive     = cfg.active_account === id
            const hasCookie    = !!unprotectCookie(acc.cookie_protected)
            const profileCount = Object.keys(acc.profiles ?? {}).length

            return (
              <Card key={id} style={{ border: isActive ? '1px solid rgba(61,126,255,0.3)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 'var(--r)',
                    background: 'linear-gradient(135deg, var(--accent-dim), var(--surface-3))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <User size={18} color="var(--accent)" />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{acc.username}</span>
                      {isActive && <Badge variant="accent">Active</Badge>}
                      <Badge variant={hasCookie ? 'success' : 'danger'}>
                        {hasCookie ? '✓ Verified' : '✗ Not verified'}
                      </Badge>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {profileCount} profile{profileCount !== 1 ? 's' : ''}
                      {acc.active_profile && ` · Active: ${acc.active_profile}`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {!isActive && (
                      <Button variant="secondary" size="sm" onClick={() => setActiveAccount(id)}>
                        Set Active
                      </Button>
                    )}
                    <Button
                      variant="secondary" size="sm"
                      icon={<RefreshCw size={12} />}
                      onClick={() => setReverifying({ id, username: acc.username })}
                    >
                      Re-verify
                    </Button>
                    <Button
                      variant="danger" size="sm"
                      icon={<Trash2 size={12} />}
                      onClick={() => { if (confirm(`Remove account "${acc.username}"?`)) removeAccount(id) }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <AddAccountModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={({ username, cookiePlain }) => {
          addAccount({ username, cookiePlain })
          setShowAdd(false)
        }}
      />

      {reverifying && (
        <AddAccountModal
          open
          initialUsername={reverifying.username}
          isReverify
          onClose={() => setReverifying(null)}
          onSave={({ cookiePlain }) => {
            updateAccountCookie(reverifying.id, cookiePlain)
            setReverifying(null)
          }}
        />
      )}
    </div>
  )
}

function AddAccountModal({ open, onClose, onSave, initialUsername = '', isReverify = false }) {
  const [username,    setUsername]    = useState(initialUsername)
  const [cookiePasted, setCookiePasted] = useState('')
  const [error,       setError]       = useState('')
  const [loginStatus, setLoginStatus] = useState('idle')

  const textareaRef = useRef(null)

  const cookieNativeRef = useNativePaste(val => {
    setCookiePasted(val)
    if (val) setError('')
  })

  const setCookieRef = el => {
    textareaRef.current = el
    cookieNativeRef(el)
  }

  const handleLoginWindow = async () => {
    setLoginStatus('waiting')
    setError('')

    try {
      let result = null

      if (isElectron && window.electronAPI?.auth) {

        result = await window.electronAPI.auth.openLoginWindow(isReverify ? initialUsername : '')
      } else if (isCapacitor && CookieCapture) {

        result = await CookieCapture.openLoginWindow()
      }

      if (!result || !result.ok || !result.cookie) {
        setLoginStatus('idle')
        return
      }

      if (result.username && !username.trim()) setUsername(result.username)

      setLoginStatus('success')

      const finalUsername = result.username || username.trim()

      if (!isReverify && !finalUsername) {

        setCookiePasted(result.cookie)
        setLoginStatus('idle')
        setError('Cookie capturado! Agora digite seu username do Roblox e clique em Save.')
        return
      }

      onSave({ username: finalUsername || initialUsername, cookiePlain: result.cookie })

    } catch (e) {
      setLoginStatus('error')
      setError(`Erro ao abrir login: ${e.message}`)
    }
  }

  const handleManualSave = () => {
    if (!isReverify && !username.trim()) return setError('Digite seu username do Roblox')

    const rawValue = textareaRef.current?.value ?? cookiePasted
    const cookiePlain = extractCookieValue(rawValue.trim())
    if (!cookiePlain) return setError('Cole um valor válido do cookie _RoliVerification')

    onSave({ username: username.trim() || initialUsername, cookiePlain })
  }

  const handleCookieChange = e => {
    setCookiePasted(e.target.value)
    setError('')
  }

  const hasCookieValue = !!cookiePasted.trim() || !!(textareaRef.current?.value?.trim())

  return (
    <Modal open={open} onClose={onClose} title={isReverify ? 'Re-verify Account' : 'Add Account'} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {}
        {hasAutoLogin && (
          <div style={{
            padding: '18px 20px',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(61,126,255,0.3)',
            borderRadius: 'var(--r)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LogIn size={16} color="var(--accent)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                Entrar automaticamente
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {isCapacitor
                ? 'Abre uma janela de login do Rolimons. Entre com sua conta Roblox e o cookie é capturado automaticamente — sem precisar copiar nada.'
                : 'Abre uma janela de login isolada. Entre com sua conta Roblox e o cookie é capturado automaticamente.'}
            </div>
            <Button
              icon={loginStatus === 'waiting' ? undefined : <LogIn size={13} />}
              loading={loginStatus === 'waiting'}
              variant={loginStatus === 'success' ? 'success' : 'primary'}
              onClick={handleLoginWindow}
              disabled={loginStatus === 'waiting'}
            >
              {loginStatus === 'waiting' ? 'Aguardando login…'
               : loginStatus === 'success' ? '✓ Logado!'
               : 'Abrir login do Rolimons'}
            </Button>
            {loginStatus === 'waiting' && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Complete o login na janela. Ela fecha automaticamente quando o cookie for capturado.
              </div>
            )}
          </div>
        )}

        {}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {hasAutoLogin ? 'ou cole manualmente' : 'Cole seu cookie'}
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {}
        {!isReverify && (
          <Input
            label="Username do Roblox"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="SeuUsername"
          />
        )}

        {}
        {!hasAutoLogin && (
          <div style={{
            background: 'var(--surface-2)', borderRadius: 'var(--r)',
            padding: '12px 14px', border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7,
          }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={13} color="var(--accent)" /> Como pegar seu cookie
            </div>
            <ol style={{ paddingLeft: 16, margin: 0 }}>
              <li>Acesse <a href="https://www.rolimons.com/verify" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>rolimons.com/verify</a> e faça login</li>
              <li>Abra o DevTools (F12) → Application → Cookies → rolimons.com</li>
              <li>Copie o valor de <code style={{ background: 'var(--surface-3)', padding: '1px 4px', borderRadius: 3 }}>_RoliVerification</code></li>
            </ol>
          </div>
        )}

        {}
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Valor do cookie _RoliVerification
          </label>
          <textarea
            ref={setCookieRef}
            value={cookiePasted}
            onChange={handleCookieChange}
            placeholder="Cole o valor do cookie aqui…"
            style={{
              width: '100%', height: 80,
              background: 'var(--surface)',
              border: `1px solid ${error && !error.includes('capturado') ? 'var(--danger)' : 'var(--border-light)'}`,
              borderRadius: 'var(--r-sm)',
              color: 'var(--text)', padding: '8px 12px',
              fontSize: 12, fontFamily: 'var(--font-mono)',
              resize: 'none', outline: 'none',

              WebkitTextSizeAdjust: '100%',
            }}
          />
        </div>

        {error && (
          <Alert variant={error.includes('capturado') ? 'success' : 'danger'}>
            <AlertTriangle size={13} /> {error}
          </Alert>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            icon={<ShieldCheck size={13} />}
            onClick={handleManualSave}
            disabled={!hasCookieValue}
          >
            {isReverify ? 'Atualizar Cookie' : 'Save Account'}
          </Button>
        </div>

      </div>
    </Modal>
  )
}
