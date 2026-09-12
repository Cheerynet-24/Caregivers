import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminAPI } from '../services/api'
import { Users, Wallet, CreditCard, LogOut, Check, X, Ban, VolumeX, Volume2, Plus, Minus } from 'lucide-react'

export default function Admin() {
  const { t, i18n } = useTranslation()
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [deposits, setDeposits] = useState([])
  const [withdraws, setWithdraws] = useState([])
  const [paymentForm, setPaymentForm] = useState({ bank_name: '', account_name: '', phone_number: '', instructions: '' })
  const [coinForm, setCoinForm] = useState({ userId: '', amount: '', type: 'add' })

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      await adminAPI.login(password)
      setAuthed(true)
      loadUsers()
    } catch {
      setError('Wrong password')
    }
  }

  const loadUsers = async () => {
    try {
      const res = await adminAPI.users(password)
      setUsers(res.data.users || [])
    } catch {}
  }

  const loadDeposits = async () => {
    try {
      const res = await adminAPI.deposits(password)
      setDeposits(res.data.requests || [])
    } catch {}
  }

  const loadWithdraws = async () => {
    try {
      const res = await adminAPI.withdraws(password)
      setWithdraws(res.data.requests || [])
    } catch {}
  }

  const loadPayment = async () => {
    try {
      const res = await adminAPI.getPaymentInfo(password)
      setPaymentForm(prev => ({ ...prev, ...res.data.paymentInfo }))
    } catch {}
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <form onSubmit={handleLogin} className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-white text-center mb-6">{t('adminPanel')}</h1>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={t('password')}
            className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl mb-4 outline-none" required />
          <button type="submit" className="w-full bg-sky-500 text-white py-3 rounded-xl font-medium">{t('login')}</button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-gray-800 text-white px-6 py-4 flex items-center gap-4">
        <img src="/favicon.jpg" alt="" className="w-8 h-8 rounded-full object-cover" />
        <h1 className="font-bold text-lg">{t('adminPanel')} - Caregivers</h1>
        <div className="flex-1" />
        <button onClick={() => i18n.changeLanguage(i18n.language === 'my' ? 'en' : 'my')} className="text-sm px-3 py-1 bg-white/10 rounded">
          {i18n.language === 'my' ? 'EN' : 'မြန်မာ'}
        </button>
        <button onClick={() => setAuthed(false)} className="p-2 hover:bg-white/10 rounded"><LogOut size={18} /></button>
      </header>

      <div className="flex">
        <nav className="w-56 bg-white dark:bg-gray-800 border-r min-h-[calc(100vh-64px)] p-4 space-y-1">
          <button onClick={() => { setTab('users'); loadUsers() }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${tab === 'users' ? 'bg-sky-100 text-sky-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
            <Users size={18} /> {t('userList')}
          </button>
          <button onClick={() => { setTab('deposits'); loadDeposits() }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${tab === 'deposits' ? 'bg-sky-100 text-sky-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
            <CreditCard size={18} /> {t('depositRequests')}
          </button>
          <button onClick={() => { setTab('withdraws'); loadWithdraws() }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${tab === 'withdraws' ? 'bg-sky-100 text-sky-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
            <Wallet size={18} /> {t('withdrawRequests')}
          </button>
          <button onClick={() => { setTab('payment'); loadPayment() }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${tab === 'payment' ? 'bg-sky-100 text-sky-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
            <CreditCard size={18} /> {t('setPaymentInfo')}
          </button>
          <button onClick={() => setTab('coins')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${tab === 'coins' ? 'bg-sky-100 text-sky-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
            <Plus size={18} /> {t('walletManage')}
          </button>
        </nav>

        <main className="flex-1 p-6 overflow-auto">
          {tab === 'users' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Coins</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-t dark:border-gray-700">
                      <td className="p-3">
                        <p className="font-medium dark:text-white">{u.displayName || u.username}</p>
                        <p className="text-xs text-gray-500">@{u.username}</p>
                      </td>
                      <td className="p-3 dark:text-white">{u.coinBalance}</td>
                      <td className="p-3">
                        {u.isBanned && <span className="text-red-500 text-xs font-medium">Banned</span>}
                        {u.isMuted && <span className="text-orange-500 text-xs font-medium ml-1">Muted</span>}
                        {u.isOnline && !u.isBanned && <span className="text-green-500 text-xs">Online</span>}
                      </td>
                      <td className="p-3 flex gap-1 flex-wrap">
                        {u.isBanned
                          ? <button onClick={() => adminAPI.unban(u.id, password).then(loadUsers)} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{t('unban')}</button>
                          : <button onClick={() => adminAPI.ban(u.id, password).then(loadUsers)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">{t('ban')}</button>}
                        {u.isMuted
                          ? <button onClick={() => adminAPI.unmute(u.id, password).then(loadUsers)} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{t('unmute')}</button>
                          : <button onClick={() => adminAPI.mute(u.id, password).then(loadUsers)} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">{t('mute')}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'deposits' && (
            <div className="space-y-3">
              {deposits.map(d => (
                <div key={d.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium dark:text-white">{d.user?.username} — {d.amount} coins</p>
                    <p className="text-xs text-gray-500">{new Date(d.createdAt).toLocaleString()} · {d.status}</p>
                    {d.screenshot && <a href={d.screenshot} target="_blank" className="text-sky-500 text-xs">Screenshot</a>}
                  </div>
                  {d.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => adminAPI.approveDeposit(d.id, password).then(loadDeposits)} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm flex items-center gap-1"><Check size={14} />{t('approve')}</button>
                      <button onClick={() => adminAPI.rejectDeposit(d.id, password).then(loadDeposits)} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm flex items-center gap-1"><X size={14} />{t('reject')}</button>
                    </div>
                  )}
                </div>
              ))}
              {deposits.length === 0 && <p className="text-gray-500">No requests</p>}
            </div>
          )}

          {tab === 'withdraws' && (
            <div className="space-y-3">
              {withdraws.map(w => (
                <div key={w.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="font-medium dark:text-white">{w.user?.username} — {w.amount} coins</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {w.accountName} · {w.phoneNumber} · {w.bankName}
                      </p>
                      <p className="text-xs text-gray-500">{new Date(w.createdAt).toLocaleString()} · {w.status}</p>
                      {w.qrCode && <img src={w.qrCode} alt="QR" className="mt-2 w-24 h-24 object-contain" />}
                    </div>
                    {w.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => adminAPI.approveWithdraw(w.id, password).then(loadWithdraws)} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm">{t('approve')}</button>
                        <button onClick={() => adminAPI.rejectWithdraw(w.id, password).then(loadWithdraws)} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm">{t('reject')}</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {withdraws.length === 0 && <p className="text-gray-500">No requests</p>}
            </div>
          )}

          {tab === 'payment' && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              const fd = new FormData()
              Object.entries(paymentForm).forEach(([k, v]) => v && fd.append(k, v))
              const file = e.target.qr?.files?.[0]
              if (file) fd.append('qr_image', file)
              await adminAPI.setPaymentInfo(fd, password)
              alert(t('success'))
            }} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow max-w-md space-y-3">
              <h2 className="font-bold text-lg dark:text-white mb-2">{t('setPaymentInfo')}</h2>
              <input value={paymentForm.bank_name || ''} onChange={e => setPaymentForm({...paymentForm, bank_name: e.target.value})}
                placeholder="Bank Name" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <input value={paymentForm.account_name || ''} onChange={e => setPaymentForm({...paymentForm, account_name: e.target.value})}
                placeholder={t('accountName')} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <input value={paymentForm.phone_number || ''} onChange={e => setPaymentForm({...paymentForm, phone_number: e.target.value})}
                placeholder={t('phoneNumber')} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <textarea value={paymentForm.instructions || ''} onChange={e => setPaymentForm({...paymentForm, instructions: e.target.value})}
                placeholder="Instructions" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={3} />
              <input type="file" name="qr" accept="image/*" className="text-sm" />
              <button type="submit" className="w-full bg-sky-500 text-white py-2.5 rounded-lg">{t('submit')}</button>
            </form>
          )}

          {tab === 'coins' && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              await adminAPI.coins(coinForm.userId, { amount: coinForm.amount, type: coinForm.type }, password)
              alert(t('success'))
              loadUsers()
            }} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow max-w-md space-y-3">
              <h2 className="font-bold text-lg dark:text-white mb-2">{t('walletManage')}</h2>
              <select value={coinForm.userId} onChange={e => setCoinForm({...coinForm, userId: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" required>
                <option value="">Select User</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.coinBalance} coins)</option>)}
              </select>
              <input type="number" value={coinForm.amount} onChange={e => setCoinForm({...coinForm, amount: e.target.value})}
                placeholder={t('amount')} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
              <div className="flex gap-2">
                <button type="button" onClick={() => setCoinForm({...coinForm, type: 'add'})}
                  className={`flex-1 py-2 rounded-lg ${coinForm.type === 'add' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
                  <Plus size={16} className="inline" /> Add
                </button>
                <button type="button" onClick={() => setCoinForm({...coinForm, type: 'remove'})}
                  className={`flex-1 py-2 rounded-lg ${coinForm.type === 'remove' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>
                  <Minus size={16} className="inline" /> Remove
                </button>
              </div>
              <button type="submit" className="w-full bg-sky-500 text-white py-2.5 rounded-lg">{t('submit')}</button>
            </form>
          )}
        </main>
      </div>
    </div>
  )
}
