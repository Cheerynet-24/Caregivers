import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminAPI, resolveMediaUrl } from '../services/api'
import { Users, Wallet, CreditCard, LogOut, Check, X, Ban, VolumeX, Volume2, Plus, Minus, Trash2, Bell, Flag } from 'lucide-react'

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
  const [paymentAccounts, setPaymentAccounts] = useState([])
  const [paymentSuccess, setPaymentSuccess] = useState('')
  const [broadcastForm, setBroadcastForm] = useState({ title: 'အသိပေးချက်', message: '' })
  const [broadcastSuccess, setBroadcastSuccess] = useState('')
  const [coinForm, setCoinForm] = useState({ userId: '', amount: '', type: 'add' })
  const [reports, setReports] = useState([])

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
      const res = await adminAPI.paymentAccounts(password)
      setPaymentAccounts(res.data.accounts || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load payment info')
    }
  }
  const loadReports = async () => {
    try { const res = await adminAPI.reports(password); setReports(res.data.reports || []) } catch (err) { setError(err.response?.data?.error || 'Failed to load reports') }
  }
  const updateReport = async (id, status) => {
    try { await adminAPI.updateReport(id, { status }, password); await loadReports() } catch (err) { setError(err.response?.data?.error || 'Failed to update report') }
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
      <header className="bg-gray-800 text-white px-3 md:px-6 py-3 md:py-4 flex items-center gap-3">
        <img src="/favicon.jpg" alt="" className="w-8 h-8 rounded-full object-cover" />
        <h1 className="font-bold text-sm md:text-lg truncate">{t('adminPanel')} - Caregivers</h1>
        <div className="flex-1" />
        <button onClick={() => i18n.changeLanguage(i18n.language === 'my' ? 'en' : 'my')} className="text-sm px-3 py-1 bg-white/10 rounded">
          {i18n.language === 'my' ? 'EN' : 'မြန်မာ'}
        </button>
        <button onClick={() => setAuthed(false)} className="p-2 hover:bg-white/10 rounded"><LogOut size={18} /></button>
      </header>

      <div className="flex flex-col md:flex-row">
        <nav className="w-full md:w-56 bg-white dark:bg-gray-800 border-b md:border-b-0 md:border-r min-h-0 md:min-h-[calc(100vh-64px)] p-2 md:p-4 flex md:block gap-1 overflow-x-auto">
          <button onClick={() => { setTab('users'); loadUsers() }}
            className={`shrink-0 md:w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${tab === 'users' ? 'bg-sky-100 text-sky-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
            <Users size={18} /> {t('userList')}
          </button>
          <button onClick={() => { setTab('deposits'); loadDeposits() }}
            className={`shrink-0 md:w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${tab === 'deposits' ? 'bg-sky-100 text-sky-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
            <CreditCard size={18} /> {t('depositRequests')}
          </button>
          <button onClick={() => { setTab('withdraws'); loadWithdraws() }}
            className={`shrink-0 md:w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${tab === 'withdraws' ? 'bg-sky-100 text-sky-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
            <Wallet size={18} /> {t('withdrawRequests')}
          </button>
          <button onClick={() => { setTab('payment'); loadPayment() }}
            className={`shrink-0 md:w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${tab === 'payment' ? 'bg-sky-100 text-sky-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
            <CreditCard size={18} /> {t('setPaymentInfo')}
          </button>
          <button onClick={() => setTab('coins')}
            className={`shrink-0 md:w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${tab === 'coins' ? 'bg-sky-100 text-sky-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
            <Plus size={18} /> {t('walletManage')}
          </button>
          <button onClick={() => setTab('broadcast')}
            className={`shrink-0 md:w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${tab === 'broadcast' ? 'bg-sky-100 text-sky-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
            <Bell size={18} /> အသိပေးစာပို့ရန်
          </button>
          <button onClick={() => { setTab('reports'); loadReports() }}
            className={`shrink-0 md:w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${tab === 'reports' ? 'bg-sky-100 text-sky-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
            <Flag size={18} /> Reports ({reports.filter(report => report.status === 'PENDING').length})
          </button>
        </nav>

        <main className="flex-1 min-w-0 w-full p-3 md:p-6 overflow-auto">
          {tab === 'users' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <table className="hidden md:table w-full text-sm">
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
                        {!u.isApproved && <span className="text-yellow-600 text-xs font-medium">Pending approval</span>}
                        {u.isBanned && <span className="text-red-500 text-xs font-medium">Banned</span>}
                        {u.isMuted && <span className="text-orange-500 text-xs font-medium ml-1">Muted</span>}
                        {u.isOnline && !u.isBanned && <span className="text-green-500 text-xs">Online</span>}
                      </td>
                      <td className="p-3 flex gap-1 flex-wrap">
                        {!u.isApproved && <button onClick={() => adminAPI.approveUser(u.id, password).then(loadUsers)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Approve</button>}
                        {u.isBanned
                          ? <button onClick={() => adminAPI.unban(u.id, password).then(loadUsers)} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{t('unban')}</button>
                          : <button onClick={() => adminAPI.ban(u.id, password).then(loadUsers)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">{t('ban')}</button>}
                        {u.isMuted
                          ? <button onClick={() => adminAPI.unmute(u.id, password).then(loadUsers)} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{t('unmute')}</button>
                          : <button onClick={() => adminAPI.mute(u.id, password).then(loadUsers)} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">{t('mute')}</button>}
                        <button onClick={async () => { if (window.confirm(`Reset password for ${u.username}?`)) { const res = await adminAPI.resetPassword(u.id, password); window.alert(`Username: ${res.data.username}\nTemporary password: ${res.data.temporaryPassword}\nဒီ password ကို တစ်ကြိမ်ပဲ ပြထားပါတယ်။ User ကို login ဝင်ပြီး password ပြောင်းခိုင်းပါ။`) } }} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">Reset Password</button>
                        <button onClick={async () => { if (window.confirm(`Delete ${u.username}?`)) { await adminAPI.deleteUser(u.id, password); loadUsers() } }} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="md:hidden divide-y dark:divide-gray-700">
                {users.map(u => (
                  <div key={u.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white break-words">{u.displayName || u.username}</p>
                        <p className="text-xs text-gray-500 break-all">@{u.username}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-yellow-100 text-yellow-700 px-2 py-1 text-xs">{u.coinBalance || 0} coins</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {!u.isApproved && <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-1">Pending approval</span>}
                      {u.isBanned && <span className="rounded-full bg-red-100 text-red-600 px-2 py-1">Banned</span>}
                      {u.isMuted && <span className="rounded-full bg-orange-100 text-orange-600 px-2 py-1">Muted</span>}
                      {u.isOnline && !u.isBanned && <span className="rounded-full bg-green-100 text-green-600 px-2 py-1">Online</span>}
                      {!u.isBanned && !u.isMuted && !u.isOnline && <span className="rounded-full bg-gray-100 text-gray-500 px-2 py-1">Offline</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {u.isBanned
                        ? <button onClick={() => adminAPI.unban(u.id, password).then(loadUsers)} className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-xs">{t('unban')}</button>
                        : <button onClick={() => adminAPI.ban(u.id, password).then(loadUsers)} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs">{t('ban')}</button>}
                      {u.isMuted
                        ? <button onClick={() => adminAPI.unmute(u.id, password).then(loadUsers)} className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-xs">{t('unmute')}</button>
                        : <button onClick={() => adminAPI.mute(u.id, password).then(loadUsers)} className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-xs">{t('mute')}</button>}
                      {!u.isApproved && <button onClick={() => adminAPI.approveUser(u.id, password).then(loadUsers)} className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs">Approve</button>}
                      <button onClick={async () => { if (window.confirm(`Reset password for ${u.username}?`)) { const res = await adminAPI.resetPassword(u.id, password); window.alert(`Username: ${res.data.username}\nTemporary password: ${res.data.temporaryPassword}`) } }} className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-xs">Reset Password</button>
                      <button onClick={async () => { if (window.confirm(`Delete ${u.username}?`)) { await adminAPI.deleteUser(u.id, password); loadUsers() } }} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs">Delete</button>
                    </div>
                  </div>
                ))}
                {users.length === 0 && <p className="p-4 text-sm text-gray-500">No users</p>}
              </div>
            </div>
          )}

          {tab === 'deposits' && (
            <div className="space-y-3">
              {deposits.map(d => (
                <div key={d.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium dark:text-white">{d.user?.username} — {d.amount} coins</p>
                    <p className="text-xs text-gray-500">{new Date(d.createdAt).toLocaleString()} · {d.status}</p>
                    {d.screenshot && <a href={resolveMediaUrl(d.screenshot)} target="_blank" rel="noreferrer" className="text-sky-500 text-xs">Screenshot</a>}
                  </div>
                  {d.status?.toLowerCase() === 'pending' && (
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
                      {w.qrCode && <img src={resolveMediaUrl(w.qrCode)} alt="QR" className="mt-2 w-24 h-24 object-contain" />}
                    </div>
                    {w.status?.toLowerCase() === 'pending' && (
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
            <div className="max-w-2xl space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
                <h2 className="font-bold text-lg dark:text-white mb-3">{t('setPaymentInfo')}</h2>
                {paymentAccounts.length === 0 && <p className="text-sm text-gray-500 mb-3">No receiving accounts added yet.</p>}
                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  {paymentAccounts.map(account => (
                    <div key={account.id} className="border dark:border-gray-600 rounded-xl p-3 relative">
                      <button onClick={async () => { await adminAPI.deletePaymentAccount(account.id, password); setPaymentAccounts(prev => prev.filter(a => a.id !== account.id)); setPaymentSuccess('Payment account deleted') }} className="absolute top-2 right-2 text-red-500" title="Delete"><Trash2 size={16} /></button>
                      <p className="font-semibold dark:text-white pr-6">{account.method}</p>
                      <p className="text-sm dark:text-gray-300">{account.accountName}</p>
                      <p className="text-sm dark:text-gray-300">{account.phoneNumber}</p>
                      {account.qrCode && <img src={resolveMediaUrl(account.qrCode)} alt="QR" className="mt-2 w-16 h-16 object-contain" />}
                    </div>
                  ))}
                </div>
                <form onSubmit={async e => {
                  e.preventDefault()
                  try {
                    setError('')
                    const fd = new FormData()
                    Object.entries(paymentForm).forEach(([k, v]) => fd.append(k, v || ''))
                    const file = e.currentTarget.qr?.files?.[0]
                    if (file) fd.append('qr_image', file)
                    const res = await adminAPI.addPaymentAccount(fd, password)
                    setPaymentAccounts(prev => [res.data.account, ...prev])
                    setPaymentForm({ bank_name: '', account_name: '', phone_number: '', instructions: '' })
                    e.currentTarget.reset()
                    setPaymentSuccess('Payment account added successfully')
                  } catch (err) {
                    setError(err.response?.data?.error || 'Failed to add payment account')
                  }
                }} className="space-y-3">
                  {paymentSuccess && <p className="rounded-lg bg-green-100 text-green-700 px-3 py-2 text-sm">{paymentSuccess}</p>}
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <input value={paymentForm.bank_name} onChange={e => setPaymentForm({...paymentForm, bank_name: e.target.value})} placeholder="Bank / Wallet Name" required className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  <input value={paymentForm.account_name} onChange={e => setPaymentForm({...paymentForm, account_name: e.target.value})} placeholder={t('accountName')} required className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  <input value={paymentForm.phone_number} onChange={e => setPaymentForm({...paymentForm, phone_number: e.target.value})} placeholder={t('phoneNumber')} required className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  <textarea value={paymentForm.instructions} onChange={e => setPaymentForm({...paymentForm, instructions: e.target.value})} placeholder="Instructions" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={2} />
                  <input type="file" name="qr" accept="image/*" className="text-sm" />
                  <button type="submit" className="w-full bg-sky-500 text-white py-2.5 rounded-lg">{t('submit')} Account</button>
                </form>
              </div>
            </div>
          )}

          {tab === 'broadcast' && (
            <form onSubmit={async e => {
              e.preventDefault()
              try {
                setBroadcastSuccess('')
                await adminAPI.broadcast(broadcastForm, password)
                setBroadcastForm({ title: 'အသိပေးချက်', message: '' })
                setBroadcastSuccess('အသိပေးစာ အောင်မြင်စွာ ပို့ပြီးပါပြီ')
              } catch (err) {
                setError(err.response?.data?.error || 'Failed to send notification')
              }
            }} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow max-w-lg space-y-3">
              <h2 className="font-bold text-lg dark:text-white">User များထံ အသိပေးစာပို့ရန်</h2>
              {broadcastSuccess && <p className="rounded-lg bg-green-100 text-green-700 px-3 py-2 text-sm">{broadcastSuccess}</p>}
              <input value={broadcastForm.title} onChange={e => setBroadcastForm({ ...broadcastForm, title: e.target.value })} placeholder="ခေါင်းစဉ်" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <textarea value={broadcastForm.message} onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })} placeholder="အသိပေးလိုသောစာသား" required rows={6} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <button type="submit" className="w-full bg-sky-500 text-white py-2.5 rounded-lg">📣 အသိပေးစာ ပို့မည်</button>
            </form>
          )}

          {tab === 'reports' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="text-xl font-bold dark:text-white">User Reports</h2><button onClick={loadReports} className="rounded-lg bg-sky-500 px-3 py-2 text-sm text-white">Refresh</button></div>
              {reports.length === 0 && <p className="text-sm text-gray-500">Report မရှိသေးပါ</p>}
              {reports.map(report => <article key={report.id} className="rounded-xl bg-white p-4 shadow dark:bg-gray-800"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold dark:text-white">{report.type.replace('_', ' ').toUpperCase()} · {report.reason}</p><p className="text-xs text-gray-500">တိုင်သူ: {report.reporter?.displayName || report.reporter?.username} · {new Date(report.createdAt).toLocaleString()}</p></div><span className={`rounded-full px-2 py-1 text-xs ${report.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : report.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{report.status}</span></div>{report.reportedContent && <div className="mt-3 rounded-lg border-l-4 border-red-400 bg-red-50 p-3 text-sm text-gray-700 dark:bg-red-950/30 dark:text-gray-200"><p className="mb-1 text-xs font-semibold text-red-600">Reported content</p><p className="whitespace-pre-wrap break-words">{report.reportedContent}</p></div>}<div className="mt-3 grid gap-1 text-sm dark:text-gray-200"><p><b>အကြောင်းပြချက်:</b> {report.reason}</p>{report.details && <p><b>အသေးစိတ်:</b> {report.details}</p>}{report.targetUser && <p><b>User:</b> {report.targetUser.displayName || report.targetUser.username} (@{report.targetUser.username})</p>}{report.targetMessage && <p><b>Message sender:</b> {report.targetMessage.sender?.displayName || report.targetMessage.sender?.username}</p>}{report.targetComment && <p><b>Comment author:</b> {report.targetComment.author?.displayName || report.targetComment.author?.username}</p>}{report.targetPost && <p><b>Post author:</b> {report.targetPost.author?.displayName || report.targetPost.author?.username}</p>}</div><div className="mt-4 flex flex-wrap gap-2">{report.status !== 'RESOLVED' && <button onClick={() => updateReport(report.id, 'RESOLVED')} className="rounded-lg bg-green-500 px-3 py-2 text-xs text-white">Resolve</button>}{report.status !== 'DISMISSED' && <button onClick={() => updateReport(report.id, 'DISMISSED')} className="rounded-lg bg-gray-500 px-3 py-2 text-xs text-white">Dismiss</button>}{report.status === 'PENDING' && <button onClick={() => updateReport(report.id, 'REVIEWING')} className="rounded-lg bg-amber-500 px-3 py-2 text-xs text-white">Mark reviewing</button>}</div></article>)}
            </div>
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
