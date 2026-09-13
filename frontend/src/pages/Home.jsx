import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { authAPI, chatAPI, userAPI, groupAPI, walletAPI, resolveMediaUrl } from '../services/api'
import {
  MessageCircle, Users, Search, Wallet, LogOut, Phone, Video,
  Send, Plus, UserPlus, Link as LinkIcon, X, Settings, Moon, Sun,
  ArrowLeft, PhoneOff, Mic, MicOff, VideoOff, Paperclip, Code2, Download, MapPin, MoreVertical,
  VolumeX, BellOff, Trash2, Ban, Music
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
  const [paymentAccounts, setPaymentAccounts] = useState([])
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState('')
  const [walletSuccess, setWalletSuccess] = useState('')
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', accountName: '', phoneNumber: '', bankName: '' })
  const [paymentInfo, setPaymentInfo] = useState({})
  const [dark, setDark] = useState(false)
  const [call, setCall] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [mutedCall, setMutedCall] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [showDeveloper, setShowDeveloper] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [latestNotification, setLatestNotification] = useState(null)
  const [chatBackground, setChatBackground] = useState('')
  const [showStickers, setShowStickers] = useState(false)
  const [showBackgrounds, setShowBackgrounds] = useState(false)
  const [messageMenu, setMessageMenu] = useState(null)
  const [showChatSettings, setShowChatSettings] = useState(false)
  const [chatSettings, setChatSettings] = useState({ muted: false, notifications: true, blocked: false })
  const [customSounds, setCustomSounds] = useState(() => JSON.parse(localStorage.getItem('caregivers-sounds') || '{}'))
  const soundRefs = useRef({})
  const messagesEndRef = useRef(null)
  const fileRef = useRef(null)
  const chatFileRef = useRef(null)
  const peerRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteVideoRef = useRef(null)

  useEffect(() => {
    loadConversations()
    loadGroups()
    loadFriends()
    loadNotifications()
  }, [])

  useEffect(() => {
    if (!socket) return
    const onNewMessage = (msg) => {
      if (msg.senderId !== user.id && !chatSettings.muted && chatSettings.notifications) playCustomSound('message')
      if (activeChat) {
        const matchPrivate = activeChat.type === 'private' && msg.conversationId === activeChat.id
        const matchGroup = activeChat.type === 'group' && msg.groupId === activeChat.id
        if (matchPrivate || matchGroup) {
          setMessages(prev => [...prev, msg])
        }
      }
      loadConversations()
    }
    const onUpdateMessage = msg => setMessages(prev => prev.map(item => item.id === msg.id ? { ...item, ...msg } : item))
    const onDeleteMessage = msg => setMessages(prev => prev.map(item => item.id === msg.id ? { ...item, ...msg, type: 'deleted' } : item))
    socket.on('message:new', onNewMessage)
    socket.on('message:update', onUpdateMessage)
    socket.on('message:delete', onDeleteMessage)
    return () => {
      socket.off('message:new', onNewMessage)
      socket.off('message:update', onUpdateMessage)
      socket.off('message:delete', onDeleteMessage)
    }
  }, [socket, activeChat, chatSettings])

  useEffect(() => {
    if (!socket) return
    const onNotification = notification => {
      setNotifications(prev => [notification, ...prev].slice(0, 20))
      setLatestNotification(notification)
    }
    socket.on('notification:new', onNotification)
    return () => socket.off('notification:new', onNotification)
  }, [socket])

  useEffect(() => {
    if (!socket) return
    const onOffer = ({ fromUserId, fromUsername, offer, callType }) => {
      if (!chatSettings.muted && chatSettings.notifications) playCustomSound('call')
      setIncomingCall({ fromUserId, fromUsername, offer, callType })
    }
    const onAnswer = async ({ answer }) => {
      if (peerRef.current) await peerRef.current.setRemoteDescription(answer)
    }
    const onIce = async ({ candidate }) => {
      if (peerRef.current && candidate) {
        try { await peerRef.current.addIceCandidate(candidate) } catch {}
      }
    }
    const onEnd = () => endCall(false)
    socket.on('call:offer', onOffer)
    socket.on('call:answer', onAnswer)
    socket.on('call:ice', onIce)
    socket.on('call:end', onEnd)
    return () => {
      socket.off('call:offer', onOffer)
      socket.off('call:answer', onAnswer)
      socket.off('call:ice', onIce)
      socket.off('call:end', onEnd)
    }
  }, [socket, chatSettings])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (activeChat?.id) {
      setChatBackground(localStorage.getItem(`chat-bg-${activeChat.id}`) || '')
      setChatSettings(JSON.parse(localStorage.getItem(`chat-settings-${activeChat.id}`) || '{"muted":false,"notifications":true,"blocked":false}'))
      setShowChatSettings(false)
    }
  }, [activeChat?.id])

  const saveChatSettings = next => {
    setChatSettings(next)
    if (activeChat?.id) localStorage.setItem(`chat-settings-${activeChat.id}`, JSON.stringify(next))
  }

  const playCustomSound = kind => {
    const src = customSounds[kind]
    if (!src) return
    const audio = new Audio(src)
    audio.play().catch(() => {})
    window.setTimeout(() => { audio.pause(); audio.currentTime = 0 }, 9000)
  }

  const saveCustomSound = (kind, file) => {
    if (!file) return
    if (!file.type.startsWith('audio/')) return alert('Audio file ပဲ ရွေးပါ')
    if (file.size > 3 * 1024 * 1024) return alert('Audio file size 3MB ထက်မကျော်ပါစေနဲ့')
    const reader = new FileReader()
    reader.onload = () => {
      const next = { ...customSounds, [kind]: reader.result }
      setCustomSounds(next)
      try { localStorage.setItem('caregivers-sounds', JSON.stringify(next)) } catch { return alert('ဒီ audio ကိုသိမ်းရန် file သေးသေးတစ်ခုရွေးပါ') }
      playCustomSound(kind)
    }
    reader.readAsDataURL(file)
  }

  const deleteMyAccount = async () => {
    if (!window.confirm('သင့်အကောင့်နှင့် ဒေတာအားလုံးကို ဖျက်မလား?')) return
    try {
      await authAPI.deleteAccount()
      await logout()
    } catch (err) {
      alert(err.response?.data?.error || 'အကောင့်ဖျက်၍မရပါ')
    }
  }

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

  const loadNotifications = async () => {
    try {
      const res = await userAPI.notifications()
      setNotifications(res.data.notifications || [])
    } catch {}
  }

  const loadWallet = async () => {
    setWalletError('')
    try {
      const res = await walletAPI.get()
      setWallet(res.data)
      const pi = await walletAPI.paymentInfo()
      const info = pi.data.paymentInfo || {}
      const accounts = pi.data.paymentAccounts || []
      setPaymentAccounts(accounts)
      setSelectedPaymentAccount(prev => prev || accounts[0]?.id || '')
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

  const sendMessage = async (overrideContent = null, overrideType = 'text') => {
    if ((!input.trim() && !overrideContent && !chatFileRef.current?.files?.[0]) || !activeChat || !socket) return
    let content = overrideContent || input.trim()
    let type = overrideType
    let fileUrl
    if (chatFileRef.current?.files?.[0]) {
      const formData = new FormData()
      formData.append('file', chatFileRef.current.files[0])
      try {
        const uploaded = await chatAPI.upload(formData)
        fileUrl = uploaded.data.fileUrl
        type = uploaded.data.type
        content = uploaded.data.name
      } catch (err) {
        alert(err.response?.data?.error || 'File upload failed')
        return
      }
      chatFileRef.current.value = ''
    }
    if (activeChat.type === 'private') {
      socket.emit('message:private', {
        conversationId: activeChat.id,
        content,
        type,
        fileUrl
      })
    } else {
      socket.emit('message:group', {
        groupId: activeChat.id,
        content,
        type,
        fileUrl
      })
    }
    setInput('')
    setShowStickers(false)
  }

  const sendLocation = () => {
    if (!navigator.geolocation) return alert('ဒီ browser မှာ Location မပံ့ပိုးပါ')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => sendMessage(`📍 Location: ${coords.latitude}, ${coords.longitude}\nhttps://www.google.com/maps?q=${coords.latitude},${coords.longitude}`, 'location'),
      () => alert('Location permission ကို Allow လုပ်ပြီး ပြန်ကြိုးစားပါ')
    )
  }

  const handleMessageAction = async (action, message) => {
    setMessageMenu(null)
    if (action === 'copy') {
      await navigator.clipboard?.writeText(message.content || message.fileUrl || '')
      return
    }
    if (action === 'share') {
      if (navigator.share) await navigator.share({ title: 'Caregivers message', text: message.content || '', url: message.fileUrl || undefined })
      else await navigator.clipboard?.writeText(message.content || message.fileUrl || '')
      return
    }
    if (action === 'forward') {
      if (!activeChat || !socket) return
      const payload = activeChat.type === 'private' ? { conversationId: activeChat.id } : { groupId: activeChat.id }
      socket.emit(activeChat.type === 'private' ? 'message:private' : 'message:group', { ...payload, content: `↪️ Forwarded: ${message.content || ''}`, type: message.type, fileUrl: message.fileUrl || undefined })
      return
    }
    if (action === 'edit' && message.senderId === user.id) {
      const content = window.prompt('Edit message', message.content || '')
      if (content?.trim()) socket.emit('message:edit', { messageId: message.id, content })
      return
    }
    if (action === 'delete' && message.senderId === user.id) {
      if (window.confirm('Delete this message?')) socket.emit('message:delete', { messageId: message.id })
    }
  }

  const createPeer = (targetUserId, callType) => {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    peer.onicecandidate = (event) => {
      if (event.candidate) socket.emit('call:ice', { toUserId: targetUserId, candidate: event.candidate })
    }
    peer.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0]
    }
    peerRef.current = peer
    setCall({ targetUserId, callType })
    return peer
  }

  const startCall = async (callType) => {
    if (!activeChat?.data?.id || activeChat.type !== 'private' || !socket) return
    try {
      const constraints = callType === 'video' ? { audio: true, video: true } : { audio: true, video: false }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      const peer = createPeer(activeChat.data.id, callType)
      stream.getTracks().forEach(track => peer.addTrack(track, stream))
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      socket.emit('call:offer', { toUserId: activeChat.data.id, offer, callType })
    } catch {
      alert('Microphone/Camera permission is required for calls.')
    }
  }

  const acceptCall = async () => {
    if (!incomingCall || !socket) return
    try {
      const constraints = incomingCall.callType === 'video' ? { audio: true, video: true } : { audio: true, video: false }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      const peer = createPeer(incomingCall.fromUserId, incomingCall.callType)
      stream.getTracks().forEach(track => peer.addTrack(track, stream))
      await peer.setRemoteDescription(incomingCall.offer)
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      socket.emit('call:answer', { toUserId: incomingCall.fromUserId, answer })
      setIncomingCall(null)
    } catch {
      alert('Microphone/Camera permission is required for calls.')
    }
  }

  const endCall = (notify = true) => {
    if (notify && socket && call?.targetUserId) socket.emit('call:end', { toUserId: call.targetUserId })
    peerRef.current?.close()
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    peerRef.current = null
    localStreamRef.current = null
    setCall(null)
    setIncomingCall(null)
    setMutedCall(false)
    setCameraOff(false)
  }

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setMutedCall(!track.enabled)
    }
  }

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setCameraOff(!track.enabled)
    }
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
    if (selectedPaymentAccount) formData.append('accountId', selectedPaymentAccount)
    if (fileRef.current?.files[0]) formData.append('screenshot', fileRef.current.files[0])
    try {
      await walletAPI.deposit(formData)
      setWalletSuccess('တင်သွင်းမှုအောင်မြင်ပါသည်')
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
      setWalletSuccess('တင်သွင်းမှုအောင်မြင်ပါသည်')
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
      <div className={`${activeChat ? 'hidden md:flex' : 'flex'} w-16 md:w-20 bg-sky-600 dark:bg-gray-900 flex-col items-center py-4 gap-4`}>
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
        <button onClick={() => setShowDeveloper(true)} className="p-3 text-white/70 hover:bg-white/10 rounded-xl" title="Developer">
          <Code2 size={20} />
        </button>
        <button onClick={toggleDark} className="p-3 text-white/70 hover:bg-white/10 rounded-xl">
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button onClick={() => i18n.changeLanguage(i18n.language === 'my' ? 'en' : 'my')} className="text-white text-xs font-bold px-2 py-1 rounded bg-white/20">
          {i18n.language === 'my' ? 'EN' : 'မြန်'}
        </button>
        <button onClick={deleteMyAccount} className="p-3 text-white/70 hover:bg-red-500/30 rounded-xl" title="Delete account">
          <Trash2 size={20} />
        </button>
        <button onClick={logout} className="p-3 text-white/70 hover:bg-white/10 rounded-xl">
          <LogOut size={20} />
        </button>
      </div>

      {/* List Panel */}
      <div className={`${activeChat ? 'hidden md:flex' : 'flex'} w-full md:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col`}>
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

              {(paymentAccounts.length > 0 || paymentInfo.account_name) && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm dark:text-white">{t('paymentInfo')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(paymentAccounts.length ? paymentAccounts : [{ id: 'legacy', method: paymentInfo.bank_name, accountName: paymentInfo.account_name, phoneNumber: paymentInfo.phone_number, qrCode: paymentInfo.qr_image }]).map(account => (
                      <button type="button" key={account.id} onClick={() => account.id !== 'legacy' && setSelectedPaymentAccount(account.id)} className={`text-left border rounded-xl p-3 text-sm ${selectedPaymentAccount === account.id ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'}`}>
                        <p className="font-semibold dark:text-white">{account.method}</p>
                        <p className="dark:text-gray-300">{account.accountName}</p>
                        <p className="dark:text-gray-300">{account.phoneNumber}</p>
                        {account.qrCode && <img src={resolveMediaUrl(account.qrCode)} alt="QR" className="mt-2 w-16 h-16 object-contain" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleDeposit} className="space-y-2">
                <p className="font-semibold text-sm dark:text-white">{t('deposit')}</p>
                <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                  placeholder={t('amount')} className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                <input type="file" ref={fileRef} accept="image/*" className="text-xs" />
                {walletSuccess && <p className="rounded-lg bg-green-100 text-green-700 px-3 py-2 text-sm">{walletSuccess}</p>}
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
      <div className={`${activeChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-gray-50 dark:bg-gray-900`}>
        {activeChat ? (
          <>
            <div className="relative h-14 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex items-center px-4 gap-3">
              <button onClick={() => { setActiveChat(null); setMessages([]) }} className="md:hidden p-2 text-gray-500" aria-label="Back">
                <ArrowLeft size={20} />
              </button>
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
                  <button onClick={() => startCall('audio')} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title={t('call')}><Phone size={18} /></button>
                  <button onClick={() => startCall('video')} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title={t('videoCall')}><Video size={18} /></button>
                </>
              )}
              <button onClick={() => setShowBackgrounds(v => !v)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="Chat background"><Settings size={18} /></button>
              {showBackgrounds && <div className="absolute right-3 top-12 z-20 bg-white dark:bg-gray-800 border rounded-xl shadow p-2 flex gap-2">
                {['', 'bg-sky-50', 'bg-rose-50', 'bg-emerald-50', 'bg-amber-50'].map(bg => <button key={bg || 'default'} onClick={() => { setChatBackground(bg); localStorage.setItem(`chat-bg-${activeChat.id}`, bg); setShowBackgrounds(false) }} className={`w-7 h-7 rounded-full border ${bg || 'bg-gray-50'}`} />)}
              </div>}
              {activeChat.type === 'private' && <>
                <button onClick={() => setShowChatSettings(v => !v)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="Conversation settings"><Music size={18} /></button>
                {showChatSettings && <div className="absolute right-3 top-12 z-30 w-72 bg-white dark:bg-gray-800 border rounded-xl shadow-xl p-3 space-y-2 text-sm dark:text-white">
                  <button onClick={() => saveChatSettings({ ...chatSettings, muted: !chatSettings.muted })} className="w-full flex items-center gap-2 text-left p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><VolumeX size={16} /> {chatSettings.muted ? 'Unmute conversation' : 'Mute conversation'}</button>
                  <button onClick={() => saveChatSettings({ ...chatSettings, notifications: !chatSettings.notifications })} className="w-full flex items-center gap-2 text-left p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><BellOff size={16} /> {chatSettings.notifications ? 'Turn notifications off' : 'Turn notifications on'}</button>
                  <label className="block p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"><span className="flex items-center gap-2"><Music size={16} /> Message sound (max 9 sec)</span><input type="file" accept="audio/*" className="mt-1 w-full text-xs" onChange={e => saveCustomSound('message', e.target.files[0])} /></label>
                  <label className="block p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"><span className="flex items-center gap-2"><Phone size={16} /> Call sound (max 9 sec)</span><input type="file" accept="audio/*" className="mt-1 w-full text-xs" onChange={e => saveCustomSound('call', e.target.files[0])} /></label>
                  <button onClick={async () => { await chatAPI[chatSettings.blocked ? 'unblockUser' : 'blockUser'](activeChat.data.id); saveChatSettings({ ...chatSettings, blocked: !chatSettings.blocked }); setShowChatSettings(false) }} className="w-full flex items-center gap-2 text-left p-2 text-orange-600 rounded-lg hover:bg-orange-50"><Ban size={16} /> {chatSettings.blocked ? 'Unblock user' : 'Block user'}</button>
                  <button onClick={async () => { if (window.confirm('Delete this conversation?')) { await chatAPI.deleteConversation(activeChat.id); setActiveChat(null); setMessages([]); loadConversations(); setShowChatSettings(false) } }} className="w-full flex items-center gap-2 text-left p-2 text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={16} /> Delete conversation</button>
                </div>}
              </>}
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

            <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${chatBackground}`}>
              {messages.length === 0 && (
                <p className="text-center text-gray-400 text-sm mt-10">{t('noMessages')}</p>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                  <div className="relative group max-w-[85%]">
                  <div className={`max-w-full px-4 py-2 rounded-2xl text-sm ${
                    m.senderId === user.id
                      ? 'bg-sky-500 text-white rounded-br-md'
                      : 'bg-white dark:bg-gray-700 dark:text-white rounded-bl-md shadow-sm'
                  }`}>
                    {activeChat.type === 'group' && m.senderId !== user.id && (
                      <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 mb-0.5">{m.sender?.displayName || m.sender?.username}</p>
                    )}
                    {m.type === 'deleted' ? <p className="italic opacity-70">This message was deleted</p>
                      : m.type === 'image' && m.fileUrl ? <><img src={resolveMediaUrl(m.fileUrl)} alt={m.content || 'Image'} className="max-w-full rounded-lg" /><a href={resolveMediaUrl(m.fileUrl)} download={m.content || 'image'} className="mt-1 inline-flex items-center gap-1 text-xs underline"><Download size={13} /> Save image</a></>
                      : m.type === 'video' && m.fileUrl ? <><video src={resolveMediaUrl(m.fileUrl)} controls className="max-w-full rounded-lg" /><a href={resolveMediaUrl(m.fileUrl)} download={m.content || 'video'} className="mt-1 inline-flex items-center gap-1 text-xs underline"><Download size={13} /> Save video</a></>
                      : m.type === 'audio' && m.fileUrl ? <audio src={resolveMediaUrl(m.fileUrl)} controls />
                      : m.type === 'file' && m.fileUrl ? <a href={resolveMediaUrl(m.fileUrl)} download={m.content || 'file'} className="inline-flex items-center gap-1 underline"><Download size={14} /> {m.content || 'Download file'}</a>
                      : m.type === 'location' ? <a href={m.content.split('\n').pop()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><MapPin size={16} /> Open location</a>
                      : <p className={m.type === 'sticker' ? 'text-5xl' : ''}>{m.content}</p>}
                    <p className={`text-[10px] mt-1 ${m.senderId === user.id ? 'text-sky-100' : 'text-gray-400'}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button onClick={() => setMessageMenu(messageMenu === m.id ? null : m.id)} className="absolute -right-8 top-1 p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-sky-500" title="Message actions"><MoreVertical size={17} /></button>
                  {messageMenu === m.id && <div className={`absolute z-20 top-8 ${m.senderId === user.id ? 'right-0' : 'left-0'} bg-white dark:bg-gray-800 border rounded-xl shadow-lg p-1 min-w-32 text-xs dark:text-white`}>
                    {['share', 'forward', 'copy', ...(m.senderId === user.id && m.type !== 'deleted' ? ['edit', 'delete'] : [])].map(action => <button key={action} onClick={() => handleMessageAction(action, m)} className="block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 capitalize">{action}</button>)}
                  </div>}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex gap-2 items-center relative">
              <input ref={chatFileRef} type="file" accept="image/*,video/*,audio/*,.pdf" className="hidden" onChange={() => sendMessage()} />
              <button onClick={() => chatFileRef.current?.click()} className="p-2 text-gray-500" title="Attach file"><Paperclip size={19} /></button>
              <button onClick={sendLocation} className="p-2 text-gray-500" title="Send location"><MapPin size={19} /></button>
              <button onClick={() => setShowStickers(v => !v)} className="p-2 text-gray-500 text-lg" title="Sticker">☺</button>
              {showStickers && <div className="absolute bottom-14 left-2 bg-white dark:bg-gray-800 border rounded-xl shadow p-2 grid grid-cols-5 gap-2">
                {['😀','😂','😍','🥰','😎','😢','😡','👍','❤️','🎉','🙏','🔥','👏','🤝','✨'].map(sticker => <button key={sticker} onClick={() => sendMessage(sticker, 'sticker')} className="text-2xl hover:bg-gray-100 rounded p-1">{sticker}</button>)}
              </div>}
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

      {latestNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-white dark:bg-gray-800 border border-sky-200 rounded-2xl shadow-xl p-4">
          <button onClick={() => setLatestNotification(null)} className="absolute top-2 right-3 text-gray-400"><X size={18} /></button>
          <p className="font-bold text-sky-600 dark:text-sky-300">📣 {latestNotification.title}</p>
          <p className="mt-1 text-sm dark:text-gray-200 whitespace-pre-wrap">{latestNotification.message}</p>
        </div>
      )}
      {showDeveloper && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowDeveloper(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white p-7 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-3">🧑‍💻✨</div>
            <h2 className="text-2xl font-bold">Developer - Mg Flâsh</h2>
            <p className="mt-3 text-white/90">Caregivers ကို တည်ဆောက်ပေးသူ</p>
            <a href="https://t.me/ckstore22" target="_blank" rel="noreferrer" className="inline-block mt-4 px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 underline">🔗 t.me/ckstore22</a>
            <p className="mt-5 font-medium">အားလုံးပဲ အဆင်ပြေကြပါစေခဗျာ 🙏💙</p>
            <button onClick={() => setShowDeveloper(false)} className="mt-6 px-5 py-2 rounded-full bg-white text-sky-700 font-semibold">ပိတ်မည်</button>
          </div>
        </div>
      )}
      {incomingCall && !call && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
            <p className="text-lg font-semibold dark:text-white mb-2">Incoming {incomingCall.callType} call</p>
            <p className="text-gray-500 mb-5">{incomingCall.fromUsername} is calling you</p>
            <div className="flex gap-3">
              <button onClick={() => { socket.emit('call:end', { toUserId: incomingCall.fromUserId }); setIncomingCall(null) }} className="flex-1 py-3 rounded-xl bg-red-500 text-white">Decline</button>
              <button onClick={acceptCall} className="flex-1 py-3 rounded-xl bg-green-500 text-white">Accept</button>
            </div>
          </div>
        </div>
      )}

      {call && (
        <div className="fixed inset-0 z-40 bg-gray-950 flex flex-col">
          <div className="flex-1 relative flex items-center justify-center">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
            <video
              ref={element => { if (element && localStreamRef.current) element.srcObject = localStreamRef.current }}
              autoPlay muted playsInline
              className={`absolute right-4 top-4 w-28 h-40 sm:w-40 sm:h-56 object-cover rounded-xl border-2 border-white ${call.callType === 'audio' || cameraOff ? 'hidden' : ''}`}
            />
            {call.callType === 'audio' && <p className="text-white text-xl">Voice call in progress</p>}
          </div>
          <div className="p-5 flex items-center justify-center gap-4 bg-gray-900">
            <button onClick={toggleMute} className="p-4 rounded-full bg-gray-700 text-white" title="Mute">
              {mutedCall ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            {call.callType === 'video' && <button onClick={toggleCamera} className="p-4 rounded-full bg-gray-700 text-white" title="Camera">
              {cameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>}
            <button onClick={() => endCall(true)} className="p-4 rounded-full bg-red-600 text-white" title="End call"><PhoneOff size={22} /></button>
          </div>
        </div>
      )}

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
