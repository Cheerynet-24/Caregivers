import { useEffect, useState } from 'react'

const keyFor = (userId, name) => `caregivers-app-lock-${userId}-${name}`
const digest = async value => {
  if (window.crypto?.subtle) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  }
  return btoa(unescape(encodeURIComponent(value)))
}

export default function AppLock({ user, children }) {
  const storageKey = keyFor(user?.id || 'guest', 'settings')
  const [settings, setSettings] = useState(() => JSON.parse(localStorage.getItem(storageKey) || '{"enabled":false}'))
  const [locked, setLocked] = useState(Boolean(settings.enabled))
  const [showSettings, setShowSettings] = useState(false)
  const [mode, setMode] = useState(settings.enabled ? 'unlock' : 'setup')
  const [password, setPassword] = useState('')
  const [recoveryName, setRecoveryName] = useState('')
  const [error, setError] = useState('')

  const persist = next => { setSettings(next); localStorage.setItem(storageKey, JSON.stringify(next)) }
  const configure = async () => {
    if (!password || password.length < 4 || !recoveryName.trim()) return setError('Password အနည်းဆုံး ၄ လုံးနဲ့ Name ထည့်ပါ')
    persist({ enabled: true, passwordHash: await digest(password), recoveryName: recoveryName.trim() })
    setPassword(''); setRecoveryName(''); setError(''); setShowSettings(false); setLocked(false)
  }
  const unlock = async () => {
    if ((await digest(password)) === settings.passwordHash) { setPassword(''); setError(''); setLocked(false) }
    else setError('Password မှားနေပါတယ်')
  }
  const recover = async () => {
    if (!recoveryName.trim() || recoveryName.trim().toLowerCase() !== String(settings.recoveryName || '').toLowerCase()) return setError('Name မကိုက်ညီပါ')
    setMode('setup'); setPassword(''); setRecoveryName(''); setError('Name ကိုက်ညီပါတယ်။ Lock အသစ်သတ်မှတ်ပါ')
  }
  useEffect(() => {
    const open = () => { setShowSettings(true); setMode('setup'); setError('') }
    window.addEventListener('caregivers:app-lock-settings', open)
    return () => window.removeEventListener('caregivers:app-lock-settings', open)
  }, [settings.enabled])
  useEffect(() => { const onVisibility = () => { if (document.hidden && settings.enabled) setLocked(true) }; document.addEventListener('visibilitychange', onVisibility); return () => document.removeEventListener('visibilitychange', onVisibility) }, [settings.enabled])

  const form = <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4"><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-800"><h2 className="text-xl font-bold dark:text-white">{mode === 'unlock' ? 'App Lock' : 'Set App Lock'}</h2><p className="mt-1 text-sm text-gray-500">{mode === 'unlock' ? 'App ကိုဖွင့်ရန် password ထည့်ပါ' : 'ခံချင်ရင်ဖွင့်၊ မခံချင်ရင် ပိတ်ထားနိုင်ပါတယ်'}</p>{error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}{mode === 'unlock' ? <><input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && unlock()} placeholder="Password" className="mt-4 w-full rounded-xl border px-3 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /><button onClick={unlock} className="mt-3 w-full rounded-xl bg-sky-500 py-3 font-semibold text-white">Unlock</button><button onClick={() => { setMode('recover'); setError('') }} className="mt-3 w-full text-sm text-sky-600">Forget password?</button></> : mode === 'recover' ? <><input autoFocus value={recoveryName} onChange={e => setRecoveryName(e.target.value)} placeholder="Your recovery Name" className="mt-4 w-full rounded-xl border px-3 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /><button onClick={recover} className="mt-3 w-full rounded-xl bg-indigo-500 py-3 font-semibold text-white">Verify Name</button><button onClick={() => setMode('unlock')} className="mt-3 w-full text-sm text-gray-500">Back</button></> : <><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password (4+ characters)" className="mt-4 w-full rounded-xl border px-3 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /><input value={recoveryName} onChange={e => setRecoveryName(e.target.value)} placeholder="Recovery Name" className="mt-3 w-full rounded-xl border px-3 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /><button onClick={configure} className="mt-3 w-full rounded-xl bg-sky-500 py-3 font-semibold text-white">Save App Lock</button>{settings.enabled && <button onClick={() => { persist({ enabled: false }); setShowSettings(false); setLocked(false) }} className="mt-3 w-full rounded-xl border border-red-200 py-3 text-red-500">Turn App Lock off</button>}{showSettings && <button onClick={() => setShowSettings(false)} className="mt-3 w-full text-sm text-gray-500">Cancel</button>}</>}</div></div>
  return <>{!locked && children}{locked && form}{showSettings && !locked && form}</>
}
