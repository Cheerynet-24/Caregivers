import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { chatAPI, userAPI, groupAPI, walletAPI } from '../services/api'
import {
  MessageCircle, Users, Search, Wallet, LogOut, Phone, Video,
  Send, Plus, UserPlus, Link as LinkIcon, X, Settings, Moon, Sun
} from 'lucide-react'

export default function Home() {
  const { t, i18n } = useTranslation()
  const { user, socket, logout } = useAuth()
  const [tab, setTab] = useState('chats') // chats | groups | friends | search | wallet
  const [conversations, setConversations] = useState([])
  const [groups, setGroups] = useState([])
  const [friends, setFriends] = useState([])
  const [searchUsers, setSearchUsers] = useState([])
  const [searchQ, setSearchQ] = useState('')
  const [activeChat, setActiveChat] = useState(null) // { type: 'private'|'group', id, data }
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [wallet, setWallet] = useState(null)
  const [walletError, setWalletError] = useState('')
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', accountName: '', phoneNumber: '', bankName: '' })
  const [paymentInfo, setPaymentInfo] = useState({})
  const [dark, setDark] = useState(false)
  const messagesEndRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    loadConversations()
    loadGroups()
    loadFriends()
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('message:new', (msg) => {
      if (activeChat) {
        const matchPrivate = activeChat.type === 'private' && msg.conversationId === activeChat.id
        const matchGroup = activeChat.type === 'group' && msg.groupId === activeChat.id
        if (matchPrivate || matchGroup) {
          setMessages(prev => [...prev, msg])
        }
      }
      loadConversations()
    })
    return () => {
      socket.off('message:new')
    }
  }, [socket, activeChat])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    try {
      const res = await chatAPI.getConversations()
      setConversations(res.data.conversations || [])
    } catch {}
  }

  const loadGroups = async () => {
    try {
      const res = await groupAPI.myGroups()
      setGroups(res.data.groups || [])
    } catch {}
  }

  const loadFriends = async () => {
    try {
      const res = await userAPI.friends()
      setFriends(res.data.friends || [])
    } catch {}
  }

  const loadWallet = async () => {
    setWalletError('')
    try {
      const res = await walletAPI.get()
      setWallet(res.data)
      const pi = await walletAPI.paymentInfo()
      const info = pi.data.paymentInfo || {}
      setPaymentInfo({
        bank_name: info.method || '',
        account_name: info.accountName || '',
        phone_number: info.phoneNumber || '',
        qr_image: info.qrCode || '',
        instructions: info.instructions || ''
      })
    } catch (err) {
      setWallet(null)
      setWalletError(err.response?.data?.error || 'Wallet data could not be loaded')
    }
  }

  const handleSearch = async () => {
    try {
      const res = await userAPI.search(searchQ)
      setSearchUsers(res.data.users || [])
    } catch {}
  }

  const openPrivateChat = async (otherUser) => {
    try {
      const res = await chatAPI.getOrCreateConversation(otherUser.id)
      const conv = res.data.conversation
      setActiveChat({ type: 'private', id: conv.id, data: otherUser })
      const msgs = await chatAPI.getMessages(conv.id)
      setMessages(msgs.data.messages || [])
      setTab('chats')
    } catch {}
  }

  const openGroupChat = async (group) => {
    try {
      setActiveChat({ type: 'group', id: group.id, data: group })
      const msgs = await chatAPI.getGroupMessages(group.id)
      setMessages(msgs.data.messages || [])
      setTab('groups')
    } catch {}
  }

  const sendMessage = () => {
    if (!input.trim() || !activeChat || !socket) return
    if (activeChat.type === 'private') {
      socket.emit('message:private', {
        conversationId: activeChat.id,
        content: input.trim()
      })
    } else {
      socket.emit('message:group', {
        groupId: activeChat.id,
        content: input.trim()
      })
    }
    setInput('')
  }

  const createGroup = async () => {
    if (!groupName.trim()) return
    try {
      await groupAPI.create({ name: groupName })
      setGroupName('')
      setShowCreateGroup(false)
      loadGroups()
    } catch {}
  }

  const handleDeposit = async (e) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append('amount', depositAmount)
    if (fileRef.current?.files[0]) formData.append('screenshot', fileRef.current.files[0])
    try {
      await walletAPI.deposit(formData)
      alert(t('success'))
      setDepositAmount('')
      loadWallet()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed')
    }
  }

  const handleWithdraw = async (e) => {
    e.preventDefault()
    const formData = new FormData()
    Object.entries(withdrawForm).forEach(([k, v]) => formData.append(k, v))
    try {
      await walletAPI.withdraw(formData)
      alert(t('success'))
      setWithdrawForm({ amount: '', accountName: '', phoneNumber: '', bankName: '' })
      loadWallet()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed')
    }
  }

  const toggleDark = () => {
    setDark(!dark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <div className={`h-screen flex ${dark ? 'dark' : ''}`}>
      {/* Sidebar */}
      <div className="w-16 md:w-20 bg-sky-600 dark:bg-gray-900 flex flex-col items-center py-4 gap-4">
        <img src="/favicon.jpg" alt="" className="w-10 h-10 rounded-full object-cover" />
        <button onClick={() => setTab('chats')} className={`p-3 rounded-xl ${tab === 'chats' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}>
          <MessageCircle size={22} />
        </button>
        <button onClick={() => setTab('groups')} className={`p-3 rounded-xl ${tab === 'groups' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}>
          <Users size={22} />
        </button>
        <button onClick={() => { setTab('search'); handleSearch() }} className={`p-3 rounded-xl ${tab === 'search' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}>
          <Search size={22} />
        </button>
        <button onClick={() => { setTab('wallet'); setActiveChat(null); setMessages([]); loadWallet() }} className={`p-3 rounded-xl ${tab === 'wallet' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}>
          <Wallet size={22} />
        </button>
        <div className="flex-1" />
        <button onClick={toggleDark} className="p-3 text-white/70 hover:bg-white/10 rounded-xl">
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button onClick={() => i18n.changeLanguage(i18n.language === 'my' ? 'en' : 'my')} className="text-white text-xs font-bold px-2 py-1 rounded bg-white/20">
          {i18n.language === 'my' ? 'EN' : 'မြန်'}
        </button>
        <button onClick={logout} className="p-3 text-white/70 hover:bg-white/10 rounded-xl">
          <LogOut size={20} />
        </button>
      </div>

      {/* List Panel */}
      <div className="w-72 md:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="font-bold text-lg text-gray-800 dark:text-white">
            {tab === 'chats' && t('chats')}
            {tab === 'groups' && t('groups')}
            {tab === 'search' && t('searchFriend')}
            {tab === 'wallet' && t('wallet')}
            {tab === 'friends' && t('friends')}
          </h2>
          <p className="text-xs text-gray-500">{user?.displayName || user?.username}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'chats' && conversations.map(c => (
            <div key={c.id} onClick={() => openPrivateChat(c.otherUser)}
              className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${activeChat?.id === c.id ? 'bg-sky-50 dark:bg-sky-900/30' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold">
                {(c.otherUser?.displayName || c.otherUser?.username || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate dark:text-white">{c.otherUser?.displayName || c.otherUser?.username}</p>
                <p className="text-xs text-gray-500 truncate">{c.lastMessage?.content || ''}</p>
              </div>
              {c.otherUser?.isOnline && <span className="w-2 h-2 bg-green-500 rounded-full" />}
            </div>
          ))}

          {tab === 'groups' && (
            <>
              <button onClick={() => setShowCreateGroup(true)} className="m-3 w-[calc(100%-1.5rem)] flex items-center gap-2 px-3 py-2 bg-sky-500 text-white rounded-lg text-sm">
                <Plus size={16} /> {t('createGroup')}
              </button>
              {groups.map(g => (
                <div key={g.id} onClick={() => openGroupChat(g)}
                  className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${activeChat?.id === g.id ? 'bg-sky-50 dark:bg-sky-900/30' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                    {g.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm dark:text-white">{g.name}</p>
                    <p className="text-xs text-gray-500">{g.members?.length || 0} {t('members')}</p>
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === 'search' && (
            <div className="p-3">
              <div className="flex gap-2 mb-3">
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder={t('search')}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                <button onClick={handleSearch} className="px-3 py-2 bg-sky-500 text-white rounded-lg"><Search size={16} /></button>
              </div>
              {searchUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                  <div className="w-9 h-9 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold text-sm">
                    {(u.displayName || u.username)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium dark:text-white truncate">{u.displayName || u.username}</p>
                    <p className="text-xs text-gray-500">@{u.username}</p>
                  </div>
                  <button onClick={() => openPrivateChat(u)} className="p-1.5 text-sky-500 hover:bg-sky-50 rounded"><MessageCircle size={16} /></button>
                  <button onClick={() => userAPI.sendRequest(u.id).then(() => alert(t('success')))} className="p-1.5 text-green-500 hover:bg-green-50 rounded"><UserPlus size={16} /></button>
                </div>
              ))}
            </div>
          )}

          {tab === 'wallet' && walletError && (
            <p className="p-4 text-sm text-red-500">{walletError}</p>
          )}

          {tab === 'wallet' && wallet && (
            <div className="p-4 space-y-4">
              <div className="bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-xl p-4 text-center">
                <p className="text-sm opacity-80">{t('balance')}</p>
                <p className="text-3xl font-bold">{wallet.balance} <span className="text-lg">{t('coins')}</span></p>
              </div>

              {paymentInfo.account_name && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-sm">
                  <p className="font-semibold mb-1 dark:text-white">{t('paymentInfo')}</p>
                  <p className="dark:text-gray-300">{paymentInfo.bank_name}</p>
                  <p className="dark:text-gray-300">{paymentInfo.account_name}</p>
                  <p className="dark:text-gray-300">{paymentInfo.phone_number}</p>
                  {paymentInfo.qr_image && <img src={paymentInfo.qr_image} alt="QR" className="mt-2 w-32 h-32 object-contain" />}
                </div>
              )}

              <form onSubmit={handleDeposit} className="space-y-2">
                <p className="font-semibold text-sm dark:text-white">{t('deposit')}</p>
                <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                  placeholder={t('amount')} className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                <input type="file" ref={fileRef} accept="image/*" className="text-xs" />
                <button type="submit" className="w-full bg-green-500 text-white py-2 rounded-lg text-sm">{t('submit')}</button>
              </form>

              <form onSubmit={handleWithdraw} className="space-y-2">
                <p className="font-semibold text-sm dark:text-white">{t('withdraw')}</p>
                <input type="number" value={withdrawForm.amount} onChange={e => setWithdrawForm({...withdrawForm, amount: e.target.value})}
                  placeholder={t('amount')} className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                <input value={withdrawForm.accountName} onChange={e => setWithdrawForm({...withdrawForm, accountName: e.target.value})}
                  placeholder={t('accountName')} className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                <input value={withdrawForm.phoneNumber} onChange={e => setWithdrawForm({...withdrawForm, phoneNumber: e.target.value})}
                  placeholder={t('phoneNumber')} className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                <input value={withdrawForm.bankName} onChange={e => setWithdrawForm({...withdrawForm, bankName: e.target.value})}
                  placeholder={t('bankName')} className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                <button type="submit" className="w-full bg-orange-500 text-white py-2 rounded-lg text-sm">{t('submit')}</button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
        {activeChat ? (
          <>
            <div className="h-14 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex items-center px-4 gap-3">
              <div className="w-9 h-9 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold">
                {(activeChat.data?.displayName || activeChat.data?.name || activeChat.data?.username || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm dark:text-white">
                  {activeChat.data?.displayName || activeChat.data?.name || activeChat.data?.username}
                </p>
                {activeChat.type === 'private' && (
                  <p className="text-xs text-gray-500">{activeChat.data?.isOnline ? t('online') : t('offline')}</p>
                )}
              </div>
              {activeChat.type === 'private' && (
                <>
                  <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title={t('call')}><Phone size={18} /></button>
                  <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title={t('videoCall')}><Video size={18} /></button>
                </>
              )}
              {activeChat.type === 'group' && activeChat.data?.inviteCode && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/join/${activeChat.data.inviteCode}`)
                    alert('Invite link copied!')
                  }}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title={t('inviteLink')}>
                  <LinkIcon size={18} />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-center text-gray-400 text-sm mt-10">{t('noMessages')}</p>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                    m.senderId === user.id
                      ? 'bg-sky-500 text-white rounded-br-md'
                      : 'bg-white dark:bg-gray-700 dark:text-white rounded-bl-md shadow-sm'
                  }`}>
                    {activeChat.type === 'group' && m.senderId !== user.id && (
                      <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 mb-0.5">{m.sender?.displayName || m.sender?.username}</p>
                    )}
                    <p>{m.content}</p>
                    <p className={`text-[10px] mt-1 ${m.senderId === user.id ? 'text-sky-100' : 'text-gray-400'}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder={t('typeMessage')}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-full outline-none focus:ring-2 focus:ring-sky-400 dark:bg-gray-700 dark:text-white text-sm"
              />
              <button onClick={sendMessage} className="p-2.5 bg-sky-500 text-white rounded-full hover:bg-sky-600">
                <Send size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <img src="/favicon.jpg" alt="" className="w-24 h-24 rounded-full mx-auto mb-4 object-cover opacity-50" />
              <p className="text-lg font-medium">{t('welcome')}</p>
              <p className="text-sm mt-1">{t('appName')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold dark:text-white">{t('createGroup')}</h3>
              <button onClick={() => setShowCreateGroup(false)}><X size={20} /></button>
            </div>
            <input value={groupName} onChange={e => setGroupName(e.target.value)}
              placeholder={t('groupName')}
              className="w-full px-4 py-3 border rounded-xl mb-4 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            <button onClick={createGroup} className="w-full bg-sky-500 text-white py-3 rounded-xl font-medium">{t('submit')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
