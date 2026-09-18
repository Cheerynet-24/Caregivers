import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Copy, KeyRound } from 'lucide-react'
import { authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { t, i18n } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState('NONE')

  useEffect(() => {
    if (!username.trim()) return undefined
    let active = true
    const check = async () => {
      try {
        const result = await authAPI.resetPasswordStatus(username.trim())
        if (active && result.data.status === 'READY') setResetPassword(result.data.temporaryPassword)
      } catch {}
    }
    check()
    const timer = window.setInterval(check, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [username])

  useEffect(() => {
    if (!username.trim()) { setApprovalStatus('NONE'); return undefined }
    let active = true
    const check = async () => { try { const result = await authAPI.approvalStatus(username.trim()); if (active) setApprovalStatus(result.data.status || 'NONE') } catch {} }
    check()
    const timer = window.setInterval(check, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [username])

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const result = await login(username, password)
      if (result.mustResetPassword) window.alert('ဒီဟာက temporary password ဖြစ်ပါတယ်။ Profile ထဲက Change password မှာ password အသစ်ပြောင်းပါ။')
      navigate('/')
    } catch (err) { setError(err.response?.data?.error || 'Login failed') }
    finally { setLoading(false) }
  }

  const requestReset = async () => {
    if (!username.trim()) { setError('အရင် Username ထည့်ပါ။'); return }
    setError(''); setResetMessage(''); setResetLoading(true)
    try {
      const result = await authAPI.requestPasswordReset(username.trim())
      setResetMessage(result.data.message || 'Request တင်ပြီးပါပြီ။')
    } catch (err) { setError(err.response?.data?.error || 'Password reset request failed') }
    finally { setResetLoading(false) }
  }

  const copyResetPassword = async () => {
    try { await navigator.clipboard.writeText(resetPassword); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8"><img src="/favicon.jpg" alt="Caregivers" className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-4 border-sky-400" /><h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('appName')}</h1><p className="text-gray-500 mt-1">{t('welcome')}</p></div>
        <div className="flex justify-end mb-4 gap-2"><button onClick={() => i18n.changeLanguage('my')} className={`px-3 py-1 rounded text-sm ${i18n.language === 'my' ? 'bg-sky-500 text-white' : 'bg-gray-200'}`}>မြန်မာ</button><button onClick={() => i18n.changeLanguage('en')} className={`px-3 py-1 rounded text-sm ${i18n.language === 'en' ? 'bg-sky-500 text-white' : 'bg-gray-200'}`}>EN</button></div>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {approvalStatus === 'PENDING' && <div className="mb-4 rounded-lg bg-amber-100 p-3 text-sm text-amber-800">Account Register တင်ထားပြီးပါပြီ။ Admin လက်ခံပေးရန် စောင့်နေပါသည်။ လက်ခံပြီးမှ Login ဝင်နိုင်ပါမယ်။</div>}
        {approvalStatus === 'APPROVED' && <div className="mb-4 rounded-lg bg-green-100 p-3 text-sm text-green-800">Admin မှ Account ကို လက်ခံပြီးပါပြီ။ Login ဝင်နိုင်ပါပြီ။</div>}
        {approvalStatus === 'REJECTED' && <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800">Admin မှ Account Register ကို လက်မခံသေးပါ။ Admin ကို ဆက်သွယ်မေးမြန်းပါ။</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('username')}</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('password')}</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none" required /></div>
          <button type="submit" disabled={loading} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">{loading ? t('loading') : t('login')}</button>
        </form>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200"><KeyRound size={16} /> Password မေ့သွားပါသလား?</div>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Username ထည့်ပြီး Admin ဆီ password အသစ်တောင်းနိုင်ပါတယ်။</p>
          <button type="button" onClick={requestReset} disabled={resetLoading} className="mt-2 w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{resetLoading ? 'တောင်းဆိုနေသည်…' : 'Admin ဆီ Password အသစ်တောင်းမည်'}</button>
          {resetMessage && <p className="mt-2 text-xs text-green-700 dark:text-green-300">{resetMessage}</p>}
          {resetPassword && <div className="mt-3"><label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">Admin ပေးထားသော Temporary Password</label><div className="flex gap-2"><input readOnly value={resetPassword} className="min-w-0 flex-1 rounded-lg border border-green-300 bg-white px-3 py-2 font-mono text-sm dark:bg-gray-700 dark:text-white" /><button type="button" onClick={copyResetPassword} className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white"><Copy size={14} />{copied ? 'Copied' : 'Copy'}</button></div><p className="mt-1 text-[11px] text-gray-500">Login ဝင်ပြီး Profile ထဲမှာ password အသစ်ပြောင်းပါ။</p></div>}
        </div>
        <p className="text-center mt-6 text-gray-600 dark:text-gray-400"><Link to="/register" className="text-sky-500 hover:underline font-medium">{t('register')}</Link></p>
      </div>
    </div>
  )
}
