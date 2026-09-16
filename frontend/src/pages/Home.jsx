import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { authAPI, callAPI, chatAPI, userAPI, groupAPI, walletAPI, postsAPI, mediaAPI, reportsAPI, aiAPI, resolveMediaUrl } from '../services/api'
import { ProfilePanel, FeedPanel } from '../components/SocialPanels'
import { getSounds, saveSounds } from '../services/soundStore'
import {
  MessageCircle, Users, Search, Wallet, LogOut, Phone, Video, UserCircle, Rss,
  Send, Plus, UserPlus, Link as LinkIcon, X, Settings, Moon, Sun,
  ArrowLeft, PhoneOff, Mic, MicOff, VideoOff, Paperclip, Code2, Download, MapPin,
  VolumeX, BellOff, Bell, Trash2, Ban, Music, RefreshCw, Sparkles, Music2, DownloadCloud, LockKeyhole, Play, Flag, Bot
} from 'lucide-react'

const VIDEO_EFFECTS = [
  { id: 'none', label: 'Normal', emoji: '✨', filter: 'none', overlay: '' },
  { id: 'mono', label: 'B&W', emoji: '🖤', filter: 'grayscale(1)', overlay: '' },
  { id: 'warm', label: 'Warm', emoji: '🌅', filter: 'sepia(.72) saturate(1.2)', overlay: '' },
  { id: 'vivid', label: 'Vivid', emoji: '🌈', filter: 'contrast(1.2) saturate(1.5)', overlay: '' },
  { id: 'cool', label: 'Cool', emoji: '🧊', filter: 'hue-rotate(165deg) saturate(1.12)', overlay: '' },
  { id: 'dreamy', label: 'Dreamy', emoji: '💫', filter: 'brightness(1.08) saturate(.85) blur(.35px)', overlay: '' },
  { id: 'hearts', label: 'Hearts', emoji: '💖', filter: 'none', overlay: '💖' },
  { id: 'love', label: 'Love', emoji: '❤️', filter: 'sepia(.15) saturate(1.25)', overlay: '❤️' },
  { id: 'sparkles', label: 'Sparkles', emoji: '✨', filter: 'none', overlay: '✨' },
  { id: 'confetti', label: 'Party', emoji: '🎉', filter: 'none', overlay: '🎉' },
  { id: 'fire', label: 'Fire', emoji: '🔥', filter: 'saturate(1.35) contrast(1.08)', overlay: '🔥' },
  { id: 'rainbow', label: 'Rainbow', emoji: '🌈', filter: 'saturate(1.25)', overlay: '🌈' },
  { id: 'butterfly', label: 'Butterfly', emoji: '🦋', filter: 'none', overlay: '🦋' },
  { id: 'snow', label: 'Snow', emoji: '❄️', filter: 'brightness(1.08)', overlay: '❄️' },
  { id: 'dance', label: 'Dance', emoji: '💃', filter: 'none', overlay: '💃' }
]

const getVideoEffect = id => VIDEO_EFFECTS.find(effect => effect.id === id) || VIDEO_EFFECTS[0]
const getProfileMessageData = message => {
  if (message?.type !== 'profile' || !message.content) return null
  try {
    const profile = JSON.parse(message.content)
    return profile?.id && profile?.username ? profile : null
  } catch { return null }
}

function ProfileMessageCard({ profile, onOpen }) {
  if (!profile) return <p className="italic opacity-70">Shared profile is unavailable</p>
  return <button type="button" onClick={onOpen} className="w-full min-w-[220px] text-left rounded-xl border border-sky-200/80 bg-sky-50/80 p-3 transition hover:bg-sky-100 active:scale-[.98] dark:border-sky-700 dark:bg-sky-950/40 dark:hover:bg-sky-900/60">
    <div className="flex items-center gap-3">
      {profile.avatar ? <img src={resolveMediaUrl(profile.avatar)} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/80 dark:ring-gray-800" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-200 text-lg font-bold text-sky-700 dark:bg-sky-800 dark:text-sky-100">{(profile.displayName || profile.username || '?')[0].toUpperCase()}</div>}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-sky-600 dark:text-sky-300">Caregivers profile</p>
        <p className="truncate font-semibold text-gray-900 dark:text-white">{profile.displayName || profile.username}</p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-300">@{profile.username}</p>
      </div>
      <span className="ml-auto text-xs font-semibold text-sky-600 dark:text-sky-300">View</span>
    </div>
    {profile.bio && <p className="mt-2 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">{profile.bio}</p>}
  </button>
}

function VideoEffectOverlay({ effect }) {
  const icon = effect?.overlay
  if (!icon) return null
  return <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
    {Array.from({ length: 16 }, (_, index) => <span key={`${effect.id}-${index}`} className="video-effect-particle" style={{ '--particle-icon': `'${icon}'`, left: `${(index * 29 + 7) % 100}%`, animationDuration: `${3.6 + (index % 5) * .35}s`, animationDelay: `${(index % 8) * -.42}s` }} />)}
  </div>
}

export default function Home() {
  const { t, i18n } = useTranslation()
  const { user, socket, logout, setUser } = useAuth()
  const [tab, setTab] = useState('chats') // chats | groups | search | wallet | feed | profile | admin-noti
  const [conversations, setConversations] = useState([])
  const [groups, setGroups] = useState([])
  const [friends, setFriends] = useState([])
  const [friendRequests, setFriendRequests] = useState([])
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
  const [groupCall, setGroupCall] = useState(null)
  const [groupParticipants, setGroupParticipants] = useState([])
  const [groupMuted, setGroupMuted] = useState(false)
  const [groupCameraOff, setGroupCameraOff] = useState(false)
  const [callStatus, setCallStatus] = useState('')
  const [incomingCall, setIncomingCall] = useState(null)
  const [mutedCall, setMutedCall] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [cameraFacing, setCameraFacing] = useState('user')
  const [showDeveloper, setShowDeveloper] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [latestNotification, setLatestNotification] = useState(null)
  const [latestMessageNotification, setLatestMessageNotification] = useState(null)
  const [translations, setTranslations] = useState({})
  const [translatingKey, setTranslatingKey] = useState(null)
  const [sharePostTarget, setSharePostTarget] = useState(null)
  const [popupReply, setPopupReply] = useState('')
  const [popupReplying, setPopupReplying] = useState(false)
  const [sendingPopupReply, setSendingPopupReply] = useState(false)
  const [chatBackground, setChatBackground] = useState('')
  const [chatBackgroundImage, setChatBackgroundImage] = useState('')
  const [showStickers, setShowStickers] = useState(false)
  const [stickerTab, setStickerTab] = useState('mine')
  const [stickerMenuKey, setStickerMenuKey] = useState(null)
  const [myStickers, setMyStickers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('caregivers-my-stickers') || '[]') } catch { return [] }
  })
  const [showBackgrounds, setShowBackgrounds] = useState(false)
  const [messageMenu, setMessageMenu] = useState(null)
  const [reportTarget, setReportTarget] = useState(null)
  const [reportReason, setReportReason] = useState('Harassment or abuse')
  const [reportDetails, setReportDetails] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [aiMessages, setAiMessages] = useState([])
  const [aiInput, setAiInput] = useState('')
  const [aiSending, setAiSending] = useState(false)
  const [aiConversations, setAiConversations] = useState([])
  const [activeAiConversationId, setActiveAiConversationId] = useState(null)
  const [replyTarget, setReplyTarget] = useState(null)
  const [showChatSettings, setShowChatSettings] = useState(false)
  const [posts, setPosts] = useState([])
  const [callHistory, setCallHistory] = useState([])
  const [conversationToDelete, setConversationToDelete] = useState(null)
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [profilePosts, setProfilePosts] = useState([])
  const [profileShareTarget, setProfileShareTarget] = useState(null)
  const [profileShareUsers, setProfileShareUsers] = useState([])
  const [profileShareSearch, setProfileShareSearch] = useState('')
  const [sharingProfile, setSharingProfile] = useState(false)
  const [musicQuery, setMusicQuery] = useState('')
  const [musicResults, setMusicResults] = useState([])
  const [musicHistory, setMusicHistory] = useState(() => JSON.parse(localStorage.getItem('caregivers-music-history') || '[]'))
  const [musicQueue, setMusicQueue] = useState([])
  const [musicQueueIndex, setMusicQueueIndex] = useState(-1)
  const [playbackMode, setPlaybackMode] = useState(localStorage.getItem('caregivers-playback-mode') || 'sequence')
  const [localSongs, setLocalSongs] = useState([])
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaDownloading, setMediaDownloading] = useState(false)
  const [playerTrack, setPlayerTrack] = useState(null)
  const localMusicRef = useRef(null)
  const playerAudioRef = useRef(null)
  const musicQueueRef = useRef([])
  const musicQueueIndexRef = useRef(-1)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [videoEffect, setVideoEffect] = useState('none')
  const [showVideoEffects, setShowVideoEffects] = useState(false)
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [addingMembers, setAddingMembers] = useState(false)
  const [voiceFile, setVoiceFile] = useState(null)
  const [recordingVoice, setRecordingVoice] = useState(false)
  const [chatSettings, setChatSettings] = useState({ muted: false, notifications: true, blocked: false })
  const [audioRoute, setAudioRoute] = useState(localStorage.getItem('caregivers-audio-route') || 'earpiece')
  const [iceServers, setIceServers] = useState([])
  const [customSounds, setCustomSounds] = useState({})
  const soundRefs = useRef({})
  const messagesEndRef = useRef(null)
  const fileRef = useRef(null)
  const chatFileRef = useRef(null)
  const stickerFileRef = useRef(null)
  const messageInputRef = useRef(null)
  const stickerLongPressTimer = useRef(null)
  const stickerLongPressedRef = useRef(false)
  const peerRef = useRef(null)
  const groupPeersRef = useRef(new Map())
  const groupLocalStreamRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const rawStreamRef = useRef(null)
  const videoEffectPipelineRef = useRef(null)
  const effectSourceVideoRef = useRef(null)
  const effectAnimationRef = useRef(null)
  const videoEffectRef = useRef('none')
  const pendingIceRef = useRef([])
  const outgoingCallIdRef = useRef(null)
  const notificationAudioRef = useRef(null)
  const voiceRecorderRef = useRef(null)
  const voiceChunksRef = useRef([])
  const swipeStartXRef = useRef(0)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
    callAPI.config().then(response => setIceServers(response.data?.iceServers || [])).catch(() => {})
    loadConversations()
    loadGroups()
    loadFriends()
    loadFriendRequests()
    loadNotifications()
    loadPosts()
    loadCallHistory()
    getSounds().then(setCustomSounds)
  }, [])

  useEffect(() => {
    const loadNativeMusic = () => {
      try {
        if (!window.CaregiversLocalMusic) return
        const songs = JSON.parse(window.CaregiversLocalMusic.listSongs?.() || '[]')
        if (songs.length) {
          const normalized = songs.map(song => ({ ...song, previewUrl: song.url, artist: song.artist || 'Unknown artist' }))
          setLocalSongs(normalized); setMusicQueue(normalized); musicQueueRef.current = normalized
        } else window.CaregiversLocalMusic.requestPermission?.()
      } catch {}
    }
    window.CaregiversLocalMusicReady = loadNativeMusic
    loadNativeMusic()
    const retry = setTimeout(loadNativeMusic, 1200)
    const retryAgain = setTimeout(loadNativeMusic, 3000)
    return () => { clearTimeout(retry); clearTimeout(retryAgain); delete window.CaregiversLocalMusicReady }
  }, [])

  useEffect(() => { if (tab === 'music') window.CaregiversLocalMusic?.refresh?.() }, [tab])
  useEffect(() => {
    setUnreadChatCount(conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0) + groups.reduce((sum, item) => sum + (item.unreadCount || 0), 0))
  }, [conversations, groups])

  useEffect(() => {
    if (!socket) return
    const onNewMessage = (msg) => {
      const isIncoming = msg.senderId !== user.id
      const isCurrentChat = activeChat && ((activeChat.type === 'private' && msg.conversationId === activeChat.id) || (activeChat.type === 'group' && msg.groupId === activeChat.id))
      if (isIncoming && !isCurrentChat) {
        setLatestMessageNotification(msg)
        const title = msg.sender?.displayName || msg.sender?.username || 'New message'
        const body = msg.content || (msg.type === 'audio' ? 'Voice message' : 'Attachment')
        window.CaregiversAudio?.notify(title, body, 'message', msg.senderId || '')
        if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, tag: `message-${msg.id}` })
      }
      if (isIncoming && !chatSettings.muted && chatSettings.notifications) playCustomSound('message')
      if (activeChat) {
        const matchPrivate = activeChat.type === 'private' && msg.conversationId === activeChat.id
        const matchGroup = activeChat.type === 'group' && msg.groupId === activeChat.id
        if (matchPrivate || matchGroup) {
          if (isIncoming && msg.id) socket.emit('message:seen', { messageId: msg.id })
          setMessages(prev => {
            const pendingIndex = prev.findIndex(item => item.pending && item.senderId === msg.senderId && item.content === msg.content && item.type === msg.type)
            if (pendingIndex >= 0) return prev.map((item, index) => index === pendingIndex ? msg : item)
            if (prev.some(item => item.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
      }
      loadConversations()
      loadGroups()
    }
    const onUpdateMessage = msg => setMessages(prev => prev.map(item => item.id === msg.id ? { ...item, ...msg } : item))
    const onDeleteMessage = msg => setMessages(prev => prev.map(item => item.id === msg.id ? { ...item, ...msg, type: 'deleted' } : item))
    const onGroupAdded = ({ groupName }) => { loadGroups(); setLatestNotification({ title: 'Added to group', message: `You were added to ${groupName}` }) }
    socket.on('message:new', onNewMessage)
    socket.on('message:update', onUpdateMessage)
    socket.on('message:delete', onDeleteMessage)
    socket.on('group:added', onGroupAdded)
    return () => {
      socket.off('message:new', onNewMessage)
      socket.off('message:update', onUpdateMessage)
      socket.off('message:delete', onDeleteMessage)
      socket.off('group:added', onGroupAdded)
    }
  }, [socket, activeChat, chatSettings])

  useEffect(() => {
    if (!socket) return
    const onNotification = notification => {
      setNotifications(prev => [notification, ...prev].slice(0, 20))
      setUnreadNotificationCount(prev => prev + 1)
      setLatestNotification(notification)
      if (!chatSettings.muted && chatSettings.notifications) playCustomSound('message')
    }
    socket.on('notification:new', onNotification)
    return () => socket.off('notification:new', onNotification)
  }, [socket])

  useEffect(() => {
    if (!socket) return
    const onOffer = ({ fromUserId, fromUsername, offer, callType, callId }) => {
      if (!chatSettings.muted && chatSettings.notifications) playCustomSound('call')
      setIncomingCall({ fromUserId, fromUsername, offer, callType, callId })
      window.CaregiversAudio?.notify(`Incoming ${callType} call`, `${fromUsername} is calling you`, 'call', fromUserId)
      if (!document.hasFocus() && 'Notification' in window && Notification.permission === 'granted') new Notification(`Incoming ${callType} call`, { body: `${fromUsername} is calling you`, tag: 'incoming-call' })
    }
    const onAnswer = async ({ answer }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer))
        const queued = pendingIceRef.current.splice(0)
        for (const candidate of queued) { try { await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)) } catch {} }
      }
    }
    const onIce = async ({ candidate }) => {
      if (!candidate) return
      if (!peerRef.current?.remoteDescription) pendingIceRef.current.push(candidate)
      else { try { await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)) } catch {} }
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
    if (!socket) return
    const onJoined = ({ groupId, userId, username }) => {
      if (groupCall?.groupId !== groupId || userId === user?.id) return
      setGroupParticipants(previous => previous.some(item => item.userId === userId) ? previous : [...previous, { userId, username, stream: null }])
      createGroupPeer(userId, true, groupCall.callType).catch(() => {})
    }
    const onSignal = async ({ groupId, fromUserId, signal }) => {
      if (groupCall?.groupId !== groupId || !groupLocalStreamRef.current) return
      setGroupParticipants(previous => previous.some(item => item.userId === fromUserId) ? previous : [...previous, { userId: fromUserId, stream: null }])
      const peer = await createGroupPeer(fromUserId, false, groupCall.callType)
      if (signal.description) {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.description))
        if (signal.description.type === 'offer') { const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); socket.emit('group-call:signal', { groupId, toUserId: fromUserId, signal: { description: peer.localDescription } }) }
      }
      if (signal.candidate) { try { await peer.addIceCandidate(new RTCIceCandidate(signal.candidate)) } catch {} }
    }
    const onLeft = ({ groupId, userId }) => {
      if (groupCall?.groupId !== groupId) return
      groupPeersRef.current.get(userId)?.close(); groupPeersRef.current.delete(userId)
      setGroupParticipants(previous => previous.filter(item => item.userId !== userId))
    }
    socket.on('group-call:user-joined', onJoined)
    socket.on('group-call:signal', onSignal)
    socket.on('group-call:user-left', onLeft)
    return () => { socket.off('group-call:user-joined', onJoined); socket.off('group-call:signal', onSignal); socket.off('group-call:user-left', onLeft) }
  }, [socket, groupCall, user?.id])

  useEffect(() => {
    const sendReply = async (fromUserId, text) => {
      if (!socket?.connected || !fromUserId || !text) return false
      try {
        const res = await chatAPI.getOrCreateConversation(fromUserId)
        socket.emit('message:private', { conversationId: res.data.conversation.id, content: text, type: 'text' })
        return true
      } catch (error) { console.error('notification reply failed', error); return false }
    }
    const flushPending = async () => {
      const raw = localStorage.getItem('caregivers-pending-reply')
      if (!raw) return
      try {
        const pending = JSON.parse(raw)
        if (await sendReply(pending.fromUserId, pending.text)) localStorage.removeItem('caregivers-pending-reply')
      } catch {}
    }
    window.CaregiversNotificationReply = async (fromUserId, text) => {
      if (!fromUserId || !text) return
      if (!(await sendReply(fromUserId, text))) {
        localStorage.setItem('caregivers-pending-reply', JSON.stringify({ fromUserId, text }))
      }
    }
    socket?.on('connect', flushPending)
    if (socket?.connected) flushPending()
    return () => { socket?.off('connect', flushPending); delete window.CaregiversNotificationReply }
  }, [socket])

  useEffect(() => {
    window.CaregiversIncomingCall = (fromUserId, fromUsername, callType, offerJson, callId) => {
      if (!fromUserId || !offerJson) return false
      try {
        const offer = JSON.parse(atob(offerJson))
        setIncomingCall({ fromUserId, fromUsername: fromUsername || 'Someone', offer, callType: callType || 'audio', callId: callId || null })
        if (!chatSettings.muted && chatSettings.notifications) playCustomSound('call')
        return true
      } catch (error) {
        console.error('background call payload failed', error)
        return false
      }
    }
    return () => { delete window.CaregiversIncomingCall }
  }, [chatSettings])

  useEffect(() => {
    window.CaregiversIncomingCallAction = (action, fromUserId, callId) => {
      if (!fromUserId) return
      if (action === 'accept') return
      if (action === 'decline' || action === 'missed') {
        stopNotificationSound()
        const payload = { toUserId: fromUserId, callId, outcome: action === 'missed' ? 'missed' : 'declined' }
        if (socket?.connected) socket.emit('call:end', payload)
        else localStorage.setItem('caregivers-pending-call-action', JSON.stringify(payload))
        setIncomingCall(null)
      }
    }
    return () => { delete window.CaregiversIncomingCallAction }
  }, [socket])

  useEffect(() => {
    if (!socket) return
    const flushPendingActions = () => {
      const raw = localStorage.getItem('caregivers-pending-reply')
      if (raw) {
        localStorage.removeItem('caregivers-pending-reply')
        try { const pending = JSON.parse(raw); window.CaregiversNotificationReply?.(pending.fromUserId, pending.text) } catch {}
      }
      const pendingCall = localStorage.getItem('caregivers-pending-call-action')
      if (pendingCall) {
        try { socket.emit('call:end', JSON.parse(pendingCall)); localStorage.removeItem('caregivers-pending-call-action') } catch {}
      }
    }
    socket.on('connect', flushPendingActions)
    if (socket.connected) flushPendingActions()
    return () => socket.off('connect', flushPendingActions)
  }, [socket])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current
      remoteVideoRef.current.play?.().catch(() => {})
    }
    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current
      remoteAudioRef.current.play?.().catch(() => {})
    }
  }, [call])

  useEffect(() => {
    if (call) window.CaregiversAudio?.setRoute(audioRoute)
  }, [call, audioRoute])

  useEffect(() => {
    if (activeChat?.id) {
      setChatBackground(localStorage.getItem(`chat-bg-${activeChat.id}`) || '')
      setChatBackgroundImage(localStorage.getItem(`chat-bg-image-${activeChat.id}`) || '')
      setChatSettings(JSON.parse(localStorage.getItem(`chat-settings-${activeChat.id}`) || '{"muted":false,"notifications":true,"blocked":false}'))
      setShowChatSettings(false)
      if (activeChat.type === 'private' && activeChat.data?.id && !activeChat.data.avatar) userAPI.profile(activeChat.data.id).then(res => setActiveChat(current => current?.id === activeChat.id ? { ...current, data: { ...current.data, ...res.data.user } } : current)).catch(() => {})
    }
  }, [activeChat?.id])

  useEffect(() => {
    window.CaregiversHandleBack = () => {
      if (profileShareTarget) {
        setProfileShareTarget(null)
        return true
      }
      if (selectedProfile) {
        setSelectedProfile(null)
        return true
      }
      if (selectedGroup) {
        setSelectedGroup(null)
        return true
      }
      if (showCreateGroup) {
        setShowCreateGroup(false)
        return true
      }
      if (showDeveloper) {
        setShowDeveloper(false)
        return true
      }
      if (!activeChat) {
        window.CaregiversApp?.exit?.()
        return false
      }
      setActiveChat(null)
      setMessages([])
      setTab('chats')
      return true
    }
    return () => { delete window.CaregiversHandleBack }
  }, [activeChat, profileShareTarget, selectedProfile, selectedGroup, showCreateGroup, showDeveloper])

  const saveChatSettings = next => {
    setChatSettings(next)
    if (activeChat?.id) localStorage.setItem(`chat-settings-${activeChat.id}`, JSON.stringify(next))
  }

  const longPressTimer = useRef(null)
  const beginConversationLongPress = conversation => {
    window.clearTimeout(longPressTimer.current)
    longPressTimer.current = window.setTimeout(() => setConversationToDelete(conversation), 650)
  }
  const cancelConversationLongPress = () => window.clearTimeout(longPressTimer.current)
  const messageLongPressTimer = useRef(null)
  const beginMessageLongPress = message => {
    window.clearTimeout(messageLongPressTimer.current)
    messageLongPressTimer.current = window.setTimeout(() => setMessageMenu(message.id), 500)
  }
  const cancelMessageLongPress = () => window.clearTimeout(messageLongPressTimer.current)
  const translateText = async (key, text) => {
    if (!text?.trim()) return ''
    if (translations[key]) return translations[key]
    setTranslatingKey(key)
    try {
      const response = await aiAPI.translate(text)
      const translated = response.data.translation || ''
      setTranslations(previous => ({ ...previous, [key]: translated }))
      return translated
    } catch (error) {
      alert(error.response?.data?.error || error.message || 'ဘာသာပြန်၍မရပါ')
      return ''
    } finally { setTranslatingKey(null) }
  }
  const translateMessage = message => translateText(`message-${message.id}`, message.content || '')
  const sharePostToChat = post => setSharePostTarget(post)
  const sendPostToChat = target => {
    if (!sharePostTarget || !socket || !target) return
    const post = sharePostTarget
    const content = `📌 Post from ${post.author?.displayName || post.author?.username || 'user'}\n${post.caption || ''}${post.mediaUrl ? `\n${resolveMediaUrl(post.mediaUrl)}` : ''}`.trim()
    socket.emit(target.type === 'group' ? 'message:group' : 'message:private', target.type === 'group' ? { groupId: target.id, content, type: 'text' } : { conversationId: target.id, content, type: 'text' })
    setSharePostTarget(null)
    alert('Post ကို Chat ထဲပို့ပြီးပါပြီ')
  }
  const openReport = (type, target = {}) => {
    setMessageMenu(null)
    setReportTarget({ type, ...target })
    setReportReason(type === 'app_error' ? 'App error' : 'Harassment or abuse')
    setReportDetails('')
  }
  const submitReport = async e => {
    e.preventDefault()
    if (!reportTarget || !reportReason.trim() || (reportTarget.type === 'app_error' && !reportDetails.trim()) || reportSubmitting) return
    setReportSubmitting(true)
    try {
      await reportsAPI.create({ type: reportTarget.type, reason: reportReason.trim(), details: reportDetails.trim(), targetUserId: reportTarget.targetUserId, targetMessageId: reportTarget.targetMessageId, targetPostId: reportTarget.targetPostId, targetCommentId: reportTarget.targetCommentId })
      setReportTarget(null)
      alert('Report တင်ပြီးပါပြီ။ Admin က စစ်ဆေးပေးပါမယ်။')
    } catch (err) { alert(err.response?.data?.error || 'Report တင်၍မရပါ') }
    finally { setReportSubmitting(false) }
  }
  const sendAiMessage = async e => {
    e?.preventDefault()
    const content = aiInput.trim()
    if (!content || aiSending || !activeAiConversationId) return
    setAiInput('')
    setAiSending(true)
    try {
      const response = await aiAPI.send(activeAiConversationId, content)
      setAiMessages(items => [...items, ...response.data.messages])
      const list = await aiAPI.list()
      setAiConversations(list.data.conversations || [])
    } catch (error) {
      setAiMessages(items => [...items, { role: 'assistant', content: error.response?.data?.error || 'AI service မရနိုင်သေးပါ' }])
    } finally { setAiSending(false) }
  }
  const copyAiMessage = async content => {
    try { await navigator.clipboard.writeText(content); alert('စာကို Copy ကူးပြီးပါပြီ') } catch { alert('Copy ကူးမရပါ') }
  }
  const confirmDeleteConversation = async () => {
    if (!conversationToDelete) return
    const target = conversationToDelete
    setConversations(prev => prev.filter(item => item.id !== target.id))
    setConversationToDelete(null)
    if (activeChat?.id === target.id) { setActiveChat(null); setMessages([]) }
    try {
      await chatAPI.deleteConversation(target.id)
    } catch (err) {
      await loadConversations()
      alert(err.response?.data?.error || 'Conversation delete failed')
    }
  }

  const playCustomSound = kind => {
    const src = customSounds[kind]
    if (!src) return
    notificationAudioRef.current?.pause()
    notificationAudioRef.current?.removeAttribute('src')
    const audio = new Audio(src)
    notificationAudioRef.current = audio
    audio.play().catch(() => {})
  }

  const stopNotificationSound = () => {
    notificationAudioRef.current?.pause()
    notificationAudioRef.current?.removeAttribute('src')
    notificationAudioRef.current = null
  }

  const saveCustomSound = (kind, file) => {
    if (!file) return
    if (!file.type.startsWith('audio/')) return alert('Audio file ပဲ ရွေးပါ')
    const reader = new FileReader()
    reader.onload = () => {
      const next = { ...customSounds, [kind]: reader.result }
      setCustomSounds(next)
      saveSounds(next).catch(() => alert('အသံဖိုင်ကို သိမ်း၍မရပါ')).then(() => playCustomSound(kind))
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
      const items = res.data.conversations || []
      setConversations(items)
      setUnreadChatCount(items.reduce((sum, item) => sum + (item.unreadCount || 0), 0) + groups.reduce((sum, item) => sum + (item.unreadCount || 0), 0))
    } catch {}
  }

  const loadCallHistory = async () => {
    try { const res = await chatAPI.callHistory(); setCallHistory(res.data.calls || []) } catch {}
  }

  const loadGroups = async () => {
    try {
      const res = await groupAPI.myGroups()
      const items = res.data.groups || []
      setGroups(items)
      setUnreadChatCount(prev => conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0) + items.reduce((sum, item) => sum + (item.unreadCount || 0), 0))
    } catch {}
  }

  const loadFriends = async () => {
    try {
      const res = await userAPI.friends()
      setFriends(res.data.friends || [])
    } catch {}
  }

  const loadFriendRequests = async () => {
    try { const res = await userAPI.friendRequests(); setFriendRequests(res.data.requests || []) } catch {}
  }

  const respondToFriendRequest = async (id, action) => {
    try {
      await userAPI[action === 'accept' ? 'acceptRequest' : 'rejectRequest'](id)
      await Promise.all([loadFriends(), loadFriendRequests()])
    } catch (err) { alert(err.response?.data?.error || 'Request update failed') }
  }

  const loadNotifications = async () => {
    try {
      const res = await userAPI.notifications()
      setNotifications(res.data.notifications || [])
      setUnreadNotificationCount(res.data.unreadCount || 0)
    } catch {}
  }
  const openAdminNotifications = async () => {
    setTab('admin-noti'); setActiveChat(null); setMessages([])
    await loadNotifications()
    await userAPI.markNotificationsRead().catch(() => {})
    setUnreadNotificationCount(0)
  }
  const loadAiConversations = async (preferredId = null) => {
    try {
      const response = await aiAPI.list()
      let items = response.data.conversations || []
      if (!items.length) {
        const created = await aiAPI.create()
        items = [created.data.conversation]
      }
      setAiConversations(items)
      const selectedId = preferredId || activeAiConversationId || items[0].id
      setActiveAiConversationId(selectedId)
      const selected = await aiAPI.get(selectedId)
      setAiMessages(selected.data.conversation.messages || [])
    } catch (error) { alert(error.response?.data?.error || 'AI chats ဖွင့်မရပါ') }
  }
  const createNewAiChat = async () => {
    try {
      const response = await aiAPI.create()
      setAiConversations(items => [response.data.conversation, ...items])
      setActiveAiConversationId(response.data.conversation.id)
      setAiMessages([])
    } catch (error) { alert(error.response?.data?.error || 'New chat ဖန်တီးမရပါ') }
  }
  const selectAiChat = async id => {
    try { const response = await aiAPI.get(id); setActiveAiConversationId(id); setAiMessages(response.data.conversation.messages || []) } catch (error) { alert(error.response?.data?.error || 'AI chat ဖွင့်မရပါ') }
  }
  const deleteAiChat = async id => {
    if (!window.confirm('ဒီ AI chat ကို ဖျက်မလား?')) return
    try { await aiAPI.remove(id); const remaining = aiConversations.filter(item => item.id !== id); setAiConversations(remaining); if (id === activeAiConversationId) { if (remaining[0]) selectAiChat(remaining[0].id); else createNewAiChat() } } catch (error) { alert(error.response?.data?.error || 'AI chat ဖျက်မရပါ') }
  }

  const loadPosts = async (items) => {
    if (items) return setPosts(items)
    try {
      const res = await postsAPI.list()
      setPosts(res.data.posts || [])
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
  const showUserProfile = userItem => {
    setSelectedProfile(userItem)
    Promise.all([userAPI.profile(userItem.id), postsAPI.list()]).then(([profileRes, postsRes]) => {
      setSelectedProfile(profileRes.data.user)
      setProfilePosts((postsRes.data.posts || []).filter(post => post.authorId === userItem.id || post.author?.id === userItem.id))
    }).catch(() => {})
  }

  const openProfileSharePicker = async profile => {
    if (!profile?.id) return
    setProfileShareTarget(profile)
    setProfileShareSearch('')
    try {
      const res = await userAPI.search('')
      setProfileShareUsers((res.data.users || []).filter(item => item.id !== profile.id))
    } catch { setProfileShareUsers([]) }
  }

  const searchProfileShareUsers = async () => {
    try {
      const res = await userAPI.search(profileShareSearch)
      setProfileShareUsers((res.data.users || []).filter(item => item.id !== profileShareTarget?.id))
    } catch { setProfileShareUsers([]) }
  }

  const shareProfileToUser = async recipient => {
    if (!profileShareTarget?.id || !recipient?.id || !socket || sharingProfile) return
    setSharingProfile(true)
    const sharedProfile = {
      id: profileShareTarget.id,
      username: profileShareTarget.username,
      displayName: profileShareTarget.displayName || profileShareTarget.username,
      avatar: profileShareTarget.avatar || '',
      bio: profileShareTarget.bio || ''
    }
    const content = JSON.stringify(sharedProfile)
    try {
      const conversation = await chatAPI.getOrCreateConversation(recipient.id)
      const payload = { conversationId: conversation.data.conversation.id, content, type: 'profile' }
      if (activeChat?.type === 'private' && activeChat.id === payload.conversationId) {
        setMessages(prev => [...prev, { id: `pending-profile-${Date.now()}`, senderId: user.id, ...payload, createdAt: new Date().toISOString(), pending: true }])
      }
      socket.emit('message:private', payload)
      await loadConversations()
      setProfileShareTarget(null)
      setSelectedProfile(null)
    } catch (error) { alert(error.response?.data?.error || 'Profile share failed') }
    finally { setSharingProfile(false) }
  }

  const showGroupInfo = group => { setSelectedGroup(group); groupAPI.get(group.id).then(res => setSelectedGroup({ ...(res.data.group || res.data), myRole: res.data.myRole })).catch(() => {}) }
  const deleteGroup = async () => {
    if (!selectedGroup || selectedGroup.myRole !== 'admin' || !window.confirm('Delete this group?')) return
    try { await groupAPI.remove(selectedGroup.id); setSelectedGroup(null); setActiveChat(null); setMessages([]); await loadGroups() } catch (err) { alert(err.response?.data?.error || 'Group delete failed') }
  }
  const removeGroupMember = async userId => {
    if (!selectedGroup || selectedGroup.myRole !== 'admin') return
    try { await groupAPI.removeMember(selectedGroup.id, userId); const res = await groupAPI.get(selectedGroup.id); setSelectedGroup({ ...(res.data.group || res.data), myRole: res.data.myRole }); setGroups(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, ...(res.data.group || res.data) } : g)) } catch (err) { alert(err.response?.data?.error || 'Remove failed') }
  }
  const setGroupIcon = e => {
    const file = e.target.files?.[0]
    if (!file || !selectedGroup || selectedGroup.myRole !== 'admin') return
    const reader = new FileReader(); reader.onload = async () => { try { const res = await groupAPI.update(selectedGroup.id, { icon: reader.result }); setSelectedGroup(g => ({ ...g, ...(res.data.group || {}) })); setGroups(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, ...(res.data.group || {}) } : g)) } catch (err) { alert(err.response?.data?.error || 'Icon update failed') } }; reader.readAsDataURL(file)
  }

  const openPrivateChat = async (otherUser, knownConversationId = null) => {
    try {
      stopNotificationSound()
      setTab('chats')
      const conv = knownConversationId ? { id: knownConversationId } : (await chatAPI.getOrCreateConversation(otherUser.id)).data.conversation
      setActiveChat({ type: 'private', id: conv.id, data: otherUser })
      setMessages([])
      await chatAPI.markRead(conv.id).catch(() => {})
      chatAPI.getMessages(conv.id).then(msgs => setMessages(msgs.data.messages || [])).catch(() => {})
      await loadConversations()
    } catch {}
  }

  const replyToMessageNotification = async () => {
    if (!latestMessageNotification?.sender) return
    setPopupReply('')
    setPopupReplying(true)
    stopNotificationSound()
  }

  const sendPopupReply = async e => {
    e.preventDefault()
    const text = popupReply.trim()
    const sender = latestMessageNotification?.sender
    if (!text || !sender || !socket || sendingPopupReply) return
    setSendingPopupReply(true)
    try {
      const res = await chatAPI.getOrCreateConversation(sender.id)
      socket.emit('message:private', { conversationId: res.data.conversation.id, content: text, type: 'text' })
      setPopupReply('')
      setPopupReplying(false)
      setLatestMessageNotification(null)
    } catch (err) { alert(err.response?.data?.error || 'Reply failed') }
    finally { setSendingPopupReply(false) }
  }

  const openGroupChat = async (group) => {
    try {
      setActiveChat({ type: 'group', id: group.id, data: group })
      const msgs = await chatAPI.getGroupMessages(group.id)
      setMessages(msgs.data.messages || [])
      await groupAPI.markRead(group.id).catch(() => {})
      await loadGroups()
      setTab('groups')
    } catch {}
  }

  const addSelectedMembers = async () => {
    if (!activeChat?.id || selectedMemberIds.length === 0 || addingMembers) return
    setAddingMembers(true)
    try {
      await groupAPI.addMembers(activeChat.id, selectedMemberIds)
      const refreshed = await groupAPI.get(activeChat.id)
      setActiveChat(current => current ? { ...current, data: refreshed.data.group || refreshed.data } : current)
      setGroups(current => current.map(group => group.id === activeChat.id ? { ...group, ...(refreshed.data.group || refreshed.data) } : group))
      setSelectedMemberIds([])
      setShowAddMembers(false)
    } catch (error) { alert(error.response?.data?.error || 'Members could not be added') }
    finally { setAddingMembers(false) }
  }

  const saveMySticker = (sticker, source = 'mine') => {
    if (!sticker?.content && !sticker?.fileUrl) return
    const normalized = { content: sticker.content || '', fileUrl: sticker.fileUrl || '', type: 'sticker', source }
    setMyStickers(previous => {
      const next = [normalized, ...previous.filter(item => item.content !== normalized.content || item.fileUrl !== normalized.fileUrl || item.source !== normalized.source)].slice(0, 80)
      localStorage.setItem('caregivers-my-stickers', JSON.stringify(next))
      return next
    })
  }
  const stickerFromMessage = message => {
    if (message?.type !== 'sticker') return
    saveMySticker({ content: message.content, fileUrl: message.fileUrl }, 'other')
    setMessageMenu(null)
  }
  const stickerKey = sticker => `${sticker.fileUrl || ''}|${sticker.content || ''}|${sticker.source || 'mine'}`
  const beginStickerLongPress = sticker => {
    window.clearTimeout(stickerLongPressTimer.current)
    stickerLongPressTimer.current = window.setTimeout(() => { stickerLongPressedRef.current = true; setStickerMenuKey(stickerKey(sticker)) }, 550)
  }
  const cancelStickerLongPress = () => window.clearTimeout(stickerLongPressTimer.current)
  const deleteMySticker = sticker => {
    const key = stickerKey(sticker)
    setMyStickers(previous => {
      const next = previous.filter(item => stickerKey(item) !== key)
      localStorage.setItem('caregivers-my-stickers', JSON.stringify(next))
      return next
    })
    setStickerMenuKey(null)
  }
  const sendSavedSticker = sticker => sendMessage(sticker.content || 'Sticker', 'sticker', null, sticker.fileUrl || null)
  const createStickerFromImage = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    try {
      const fileUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('Could not read the selected image'))
        reader.onload = () => {
          const image = new Image()
          image.onerror = () => reject(new Error('Selected image could not be decoded'))
          image.onload = () => {
            const max = 256
            const scale = Math.min(1, max / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale))
            canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale))
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
            resolve(canvas.toDataURL('image/webp', 0.82))
          }
          image.src = reader.result
        }
        reader.readAsDataURL(file)
      })
      saveMySticker({ fileUrl })
      setShowStickers(true)
    } catch (error) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const uploaded = await chatAPI.upload(formData)
        saveMySticker({ fileUrl: uploaded.data.fileUrl })
        setShowStickers(true)
      } catch (fallbackError) {
        alert(fallbackError.response?.data?.error || error.message || 'Sticker upload failed')
      }
    }
  }
  const sendMessage = async (overrideContent = null, overrideType = 'text', overrideFile = null, overrideFileUrl = null) => {
    if ((!input.trim() && !overrideContent && !overrideFile && !voiceFile && !chatFileRef.current?.files?.[0]) || !activeChat || !socket) return
    let content = overrideContent || input.trim()
    if (replyTarget && !overrideContent) content = `↪ ${replyTarget.sender?.displayName || replyTarget.sender?.username || 'Message'}: ${replyTarget.content || ''}\n${content}`
    let type = overrideType
    let fileUrl = overrideFileUrl
    const selectedFile = overrideFile || voiceFile || chatFileRef.current?.files?.[0]
    if (selectedFile) {
      const formData = new FormData()
      formData.append('file', selectedFile)
      try {
        const uploaded = await chatAPI.upload(formData)
        fileUrl = uploaded.data.fileUrl
        type = overrideType === 'sticker' ? 'sticker' : uploaded.data.type
        content = uploaded.data.name
      } catch (err) {
        alert(err.response?.data?.error || 'File upload failed')
        return
      }
      chatFileRef.current.value = ''
      setVoiceFile(null)
    }
    if (activeChat.type === 'private') {
      const pendingMessage = { id: `pending-${Date.now()}`, senderId: user.id, content, type, fileUrl, createdAt: new Date().toISOString(), pending: true }
      setMessages(prev => [...prev, pendingMessage])
      socket.emit('message:private', {
        conversationId: activeChat.id,
        content,
        type,
        fileUrl
      })
    } else {
      const pendingMessage = { id: `pending-${Date.now()}`, senderId: user.id, content, type, fileUrl, createdAt: new Date().toISOString(), pending: true }
      setMessages(prev => [...prev, pendingMessage])
      socket.emit('message:group', {
        groupId: activeChat.id,
        content,
        type,
        fileUrl
      })
    }
    setInput('')
    setReplyTarget(null)
    setShowStickers(false)
  }

  const startVoiceRecording = async () => {
    if (recordingVoice) return
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return alert('ဒီဖုန်းမှာ voice recording မပံ့ပိုးပါ')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      voiceChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size) voiceChunksRef.current.push(e.data) }
      recorder.onstop = () => { stream.getTracks().forEach(track => track.stop()); const file = new File([new Blob(voiceChunksRef.current, { type: recorder.mimeType || 'audio/webm' })], `voice-${Date.now()}.webm`, { type: recorder.mimeType || 'audio/webm' }); setRecordingVoice(false); sendMessage(null, 'text', file) }
      voiceRecorderRef.current = recorder
      recorder.start()
      setRecordingVoice(true)
    } catch { alert('Microphone permission ကို Allow လုပ်ပြီး ပြန်ကြိုးစားပါ') }
  }

  const stopVoiceRecording = () => { if (recordingVoice && voiceRecorderRef.current?.state !== 'inactive') voiceRecorderRef.current.stop() }

  const sendLocation = () => {
    if (!navigator.geolocation) return alert('ဒီ browser မှာ Location မပံ့ပိုးပါ')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => sendMessage(`📍 Location: ${coords.latitude}, ${coords.longitude}\nhttps://www.google.com/maps?q=${coords.latitude},${coords.longitude}`, 'location'),
      () => alert('Location permission ကို Allow လုပ်ပြီး ပြန်ကြိုးစားပါ')
    )
  }

  const stopVideoEffectPipeline = () => {
    if (effectAnimationRef.current) cancelAnimationFrame(effectAnimationRef.current)
    effectAnimationRef.current = null
    effectSourceVideoRef.current?.pause?.()
    if (effectSourceVideoRef.current) effectSourceVideoRef.current.srcObject = null
    effectSourceVideoRef.current = null
    videoEffectPipelineRef.current?.getVideoTracks?.().forEach(track => track.stop())
    videoEffectPipelineRef.current = null
  }

  const createVideoEffectStream = async stream => {
    if (!stream?.getVideoTracks?.().length || !window.MediaStream || !document.createElement('canvas').captureStream) return stream
    stopVideoEffectPipeline()
    const sourceVideo = document.createElement('video')
    sourceVideo.muted = true
    sourceVideo.playsInline = true
    sourceVideo.srcObject = stream
    effectSourceVideoRef.current = sourceVideo
    await sourceVideo.play().catch(() => {})
    if (!sourceVideo.videoWidth) await new Promise(resolve => { sourceVideo.onloadedmetadata = resolve })
    const canvas = document.createElement('canvas')
    canvas.width = sourceVideo.videoWidth || 640
    canvas.height = sourceVideo.videoHeight || 360
    const context = canvas.getContext('2d')
    if (!context) return stream
    const effectStream = canvas.captureStream(30)
    stream.getAudioTracks?.().forEach(track => effectStream.addTrack(track))
    videoEffectPipelineRef.current = effectStream
    const drawFrame = () => {
      if (!effectSourceVideoRef.current || effectSourceVideoRef.current !== sourceVideo) return
      const effect = getVideoEffect(videoEffectRef.current)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.filter = effect.filter
      context.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height)
      context.filter = 'none'
      if (effect.overlay) {
        context.font = `${Math.max(24, Math.round(canvas.width / 10))}px sans-serif`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        for (let index = 0; index < 10; index += 1) {
          const x = ((index * 37 + 13) % 100) / 100 * canvas.width
          const y = ((index * 61 + 19) % 100) / 100 * canvas.height
          context.fillText(effect.overlay, x, y)
        }
      }
      effectAnimationRef.current = requestAnimationFrame(drawFrame)
    }
    drawFrame()
    return effectStream
  }

  const applyVideoEffect = async effectId => {
    const nextEffect = getVideoEffect(effectId)
    videoEffectRef.current = nextEffect.id
    setVideoEffect(nextEffect.id)
    setShowVideoEffects(false)
    if (!call || call.callType !== 'video' || !rawStreamRef.current) return
    try {
      const nextStream = nextEffect.id === 'none' ? (stopVideoEffectPipeline(), rawStreamRef.current) : await createVideoEffectStream(rawStreamRef.current)
      const nextTrack = nextStream.getVideoTracks?.()[0]
      const sender = peerRef.current?.getSenders().find(item => item.track?.kind === 'video')
      if (sender && nextTrack) await sender.replaceTrack(nextTrack)
      localStreamRef.current = nextStream
      if (localVideoRef.current) localVideoRef.current.srcObject = nextStream
    } catch (error) {
      console.error('video effect failed', error)
      videoEffectRef.current = 'none'
      setVideoEffect('none')
      stopVideoEffectPipeline()
      localStreamRef.current = rawStreamRef.current
      if (localVideoRef.current) localVideoRef.current.srcObject = rawStreamRef.current
    }
  }

  const handleMessageAction = async (action, message) => {
    setMessageMenu(null)
    if (action === 'copy') {
      await navigator.clipboard?.writeText(message.content || message.fileUrl || '')
      return
    }
    if (action === 'report') {
      openReport('message', { targetMessageId: message.id, content: message.content || message.fileUrl || message.type })
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

  useEffect(() => {
    const closeMessageMenu = event => {
      if (messageMenu && !event.target.closest('[data-message-menu]')) setMessageMenu(null)
    }
    document.addEventListener('pointerdown', closeMessageMenu)
    return () => document.removeEventListener('pointerdown', closeMessageMenu)
  }, [messageMenu])

  const createGroupPeer = async (remoteUserId, initiator, callType = groupCall?.callType || 'audio') => {
    if (!socket || !groupLocalStreamRef.current || groupPeersRef.current.has(remoteUserId)) return groupPeersRef.current.get(remoteUserId)
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }, ...iceServers] })
    groupPeersRef.current.set(remoteUserId, peer)
    groupLocalStreamRef.current.getTracks().forEach(track => peer.addTrack(track, groupLocalStreamRef.current))
    peer.onicecandidate = event => { if (event.candidate) socket.emit('group-call:signal', { groupId: groupCall?.groupId, toUserId: remoteUserId, signal: { candidate: event.candidate } }) }
    peer.ontrack = event => { const stream = event.streams?.[0]; if (stream) setGroupParticipants(previous => previous.map(item => item.userId === remoteUserId ? { ...item, stream } : item)) }
    peer.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) { peer.close(); groupPeersRef.current.delete(remoteUserId) } }
    if (initiator) {
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      socket.emit('group-call:signal', { groupId: groupCall?.groupId, toUserId: remoteUserId, signal: { description: peer.localDescription } })
    }
    return peer
  }
  const endGroupCall = () => {
    if (groupCall?.groupId && socket) socket.emit('group-call:leave', { groupId: groupCall.groupId })
    groupPeersRef.current.forEach(peer => peer.close())
    groupPeersRef.current.clear()
    groupLocalStreamRef.current?.getTracks().forEach(track => track.stop())
    groupLocalStreamRef.current = null
    setGroupParticipants([])
    setGroupMuted(false)
    setGroupCameraOff(false)
    setGroupCall(null)
  }
  const toggleGroupMute = () => { const next = !groupMuted; groupLocalStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next }); setGroupMuted(next) }
  const toggleGroupCamera = () => { const next = !groupCameraOff; groupLocalStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = !next }); setGroupCameraOff(next) }
  const startGroupCall = async callType => {
    if (!activeChat?.id || activeChat.type !== 'group' || !socket?.connected || groupCall) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' })
      groupLocalStreamRef.current = stream
      setGroupCall({ groupId: activeChat.id, callType })
      setGroupParticipants([])
      socket.emit('group-call:join', { groupId: activeChat.id, callType }, response => {
        if (!response?.ok) { stream.getTracks().forEach(track => track.stop()); groupLocalStreamRef.current = null; setGroupCall(null); return alert(response?.error || 'Group call join failed') }
        setGroupParticipants((response.participants || []).map(item => ({ ...item, stream: null })))
      })
    } catch (error) { alert(error.message || 'Camera/Microphone permission is required') }
  }

  const createPeer = (targetUserId, callType, configuredIceServers = iceServers) => {
    const peer = new RTCPeerConnection({ iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.nextcloud.com:443' },
      ...configuredIceServers
    ] })
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setCallStatus('Connected')
      else if (peer.connectionState === 'connecting') setCallStatus('Connecting')
      else if (['failed', 'disconnected'].includes(peer.connectionState)) setCallStatus('Connection failed')
    }
    peer.oniceconnectionstatechange = () => {
      if (['checking', 'connected'].includes(peer.iceConnectionState) && peer.connectionState !== 'connected') setCallStatus('My Connecting')
      if (peer.iceConnectionState === 'failed') setCallStatus('Connection failed')
    }
    peer.onicecandidate = (event) => {
      if (event.candidate) socket.emit('call:ice', { toUserId: targetUserId, candidate: event.candidate })
    }
    peer.onicecandidateerror = event => console.warn('ICE candidate error', event.errorCode, event.errorText)
    peer.ontrack = (event) => {
      const stream = event.streams?.[0] || remoteStreamRef.current || new MediaStream()
      if (!event.streams?.[0] && event.track && !stream.getTracks().some(track => track.id === event.track.id)) stream.addTrack(event.track)
      remoteStreamRef.current = stream
      if (remoteVideoRef.current) { remoteVideoRef.current.srcObject = stream; remoteVideoRef.current.muted = callType === 'audio'; remoteVideoRef.current.play?.().catch(() => {}) }
      if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = stream; remoteAudioRef.current.muted = false; remoteAudioRef.current.volume = 1; remoteAudioRef.current.play?.().catch(() => {}) }
      setCallStatus('Connected')
    }
    peerRef.current = peer
    setCall({ targetUserId, callType })
    return peer
  }

  const startCall = async (callType) => {
    if (!activeChat?.data?.id || activeChat.type !== 'private' || !socket) return
    if (!socket.connected) { setCallStatus('Signaling unavailable'); alert('Server connection မရှိသေးပါ။ App ကို ပြန်ဖွင့်ပြီး စမ်းပါ။'); return }
    try {
      pendingIceRef.current = []
      const constraints = callType === 'video' ? { audio: { echoCancellation: true, noiseSuppression: true }, video: true } : { audio: { echoCancellation: true, noiseSuppression: true }, video: false }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      rawStreamRef.current = stream
      videoEffectRef.current = 'none'
      setVideoEffect('none')
      localStreamRef.current = stream
      setCallStatus('Calling')
      const config = iceServers.length ? iceServers : (await callAPI.config().then(response => response.data?.iceServers || []).catch(() => []))
      const peer = createPeer(activeChat.data.id, callType, config)
      stream.getTracks().forEach(track => peer.addTrack(track, stream))
      setTimeout(() => { if (peer.connectionState === 'new') peer.restartIce?.() }, 8000)
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      let delivered = false
      socket.emit('call:offer', { toUserId: activeChat.data.id, offer, callType }, response => {
        delivered = true
        if (response?.callId) outgoingCallIdRef.current = response.callId
      })
      setTimeout(() => { if (!delivered && peerRef.current === peer) setCallStatus('Signaling failed') }, 5000)
    } catch (err) {
      alert(`Call permission failed (${err?.name || 'unknown'}). Please allow Camera/Microphone in Android Settings, then reopen the app.`)
    }
  }

  const acceptCall = async () => {
    if (!incomingCall || !socket) return
    if (!socket.connected) { setCallStatus('Signaling unavailable'); return }
    stopNotificationSound()
    try {
      const constraints = incomingCall.callType === 'video' ? { audio: { echoCancellation: true, noiseSuppression: true }, video: true } : { audio: { echoCancellation: true, noiseSuppression: true }, video: false }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      rawStreamRef.current = stream
      videoEffectRef.current = 'none'
      setVideoEffect('none')
      localStreamRef.current = stream
      setCallStatus('Connecting')
      outgoingCallIdRef.current = incomingCall.callId || null
      const config = iceServers.length ? iceServers : (await callAPI.config().then(response => response.data?.iceServers || []).catch(() => []))
      const peer = createPeer(incomingCall.fromUserId, incomingCall.callType, config)
      stream.getTracks().forEach(track => peer.addTrack(track, stream))
      await peer.setRemoteDescription(incomingCall.offer)
      const queued = pendingIceRef.current.splice(0)
      for (const candidate of queued) { try { await peer.addIceCandidate(new RTCIceCandidate(candidate)) } catch {} }
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      socket.emit('call:answer', { toUserId: incomingCall.fromUserId, answer, callId: incomingCall.callId }, () => {})
      setIncomingCall(null)
    } catch (err) {
      alert(`Call permission failed (${err?.name || 'unknown'}). Please allow Camera/Microphone in Android Settings, then reopen the app.`)
    }
  }

  const endCall = (notify = true) => {
    stopNotificationSound()
    if (notify && socket && call?.targetUserId) socket.emit('call:end', { toUserId: call.targetUserId, callId: outgoingCallIdRef.current, outcome: 'completed' })
    stopVideoEffectPipeline()
    peerRef.current?.close()
    rawStreamRef.current?.getTracks().forEach(track => track.stop())
    peerRef.current = null
    localStreamRef.current = null
    rawStreamRef.current = null
    setCall(null)
    outgoingCallIdRef.current = null
    setCallStatus('')
    setIncomingCall(null)
    setMutedCall(false)
    setCameraOff(false)
    setCameraFacing('user')
    setShowVideoEffects(false)
    videoEffectRef.current = 'none'
    setVideoEffect('none')
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
  const switchCamera = async () => {
    if (!call || call.callType !== 'video' || !localStreamRef.current || !navigator.mediaDevices?.getUserMedia) return
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user'
    try {
      const rawStream = rawStreamRef.current || localStreamRef.current
      const currentTrack = rawStream?.getVideoTracks?.()[0]
      const currentId = currentTrack?.getSettings?.().deviceId || localStreamRef.current.getVideoTracks?.()[0]?.getSettings?.().deviceId
      currentTrack?.stop()
      if (currentTrack && rawStream?.removeTrack) rawStream.removeTrack(currentTrack)
      if (localVideoRef.current) {
        localVideoRef.current.pause?.()
        localVideoRef.current.srcObject = null
      }
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
      const cameras = devices.filter(device => device.kind === 'videoinput')
      const currentIndex = currentId ? cameras.findIndex(device => device.deviceId === currentId) : (cameraFacing === 'user' ? 0 : Math.min(1, cameras.length - 1))
      const oppositeByLabel = cameras.find(device => {
        const label = (device.label || '').toLowerCase()
        const isFront = /front|user|facetime|selfie/.test(label)
        const isBack = /back|rear|environment|world/.test(label)
        return device.deviceId !== currentId && (nextFacing === 'user' ? isFront : isBack)
      })
      const wanted = oppositeByLabel || (cameras.length > 1 ? cameras[(currentIndex + 1 + cameras.length) % cameras.length] : cameras[0])
      let stream
      if (wanted?.deviceId) stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: wanted.deviceId } } })
      else try { stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { exact: nextFacing } } }) } catch { stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: nextFacing } } }) }
      const nextTrack = stream.getVideoTracks()[0]
      if (!nextTrack) return
      const sender = peerRef.current?.getSenders?.().find(item => item.track?.kind === 'video')
      rawStream?.addTrack(nextTrack)
      if (sender && !videoEffectPipelineRef.current) await sender.replaceTrack(nextTrack)
      await applyVideoEffect(videoEffectRef.current)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
        localVideoRef.current.play?.().catch(() => {})
      }
      setCameraFacing(nextFacing)
    } catch { alert('ဒီဖုန်းမှာ Camera ပြောင်းလို့မရပါ') }
  }
  const changeAudioRoute = route => {
    setAudioRoute(route)
    localStorage.setItem('caregivers-audio-route', route)
    window.CaregiversAudio?.setRoute(route)
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

  const searchMusic = async () => {
    if (!musicQuery.trim()) return
    try {
      const response = await mediaAPI.musicSearch(musicQuery.trim())
      const burmese = /[\u1000-\u109f]/
      const results = (response.data.results || []).sort((a, b) => Number(burmese.test(`${b.title} ${b.artist}`)) - Number(burmese.test(`${a.title} ${a.artist}`)))
      setMusicResults(results)
      setMusicQueue(results)
      musicQueueRef.current = results
      setMusicQueueIndex(-1)
      musicQueueIndexRef.current = -1
      const merged = [...results, ...musicHistory].filter((track, index, list) => list.findIndex(item => item.id === track.id) === index).slice(0, 60)
      setMusicHistory(merged)
      localStorage.setItem('caregivers-music-history', JSON.stringify(merged))
    } catch (error) { alert(error.response?.data?.error || 'Music search failed') }
  }
  const playMusicTrack = (track, queue = musicQueue.length ? musicQueue : [track]) => {
    if (!track?.previewUrl) return
    const nextQueue = queue.filter(item => item?.previewUrl)
    const index = Math.max(0, nextQueue.findIndex(item => item.id === track.id))
    setMusicQueue(nextQueue); musicQueueRef.current = nextQueue
    setMusicQueueIndex(index); musicQueueIndexRef.current = index
    const nextPlayerTrack = { title: `${track.title} · ${track.artist}`, url: track.previewUrl, source: track, native: track.previewUrl?.startsWith('content://') }
    setPlayerTrack(nextPlayerTrack)
    if (nextPlayerTrack.native) window.CaregiversMusic?.playLocal?.(track.previewUrl, nextPlayerTrack.title, track.artist)
  }
  const selectLocalSongs = event => {
    const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('audio/'))
    const songs = files.map(file => ({ id: `${file.name}-${file.lastModified}`, title: file.name.replace(/\.[^.]+$/, ''), artist: 'Phone music', previewUrl: URL.createObjectURL(file), file }))
    setLocalSongs(songs)
    setMusicQueue(songs); musicQueueRef.current = songs
    setMusicQueueIndex(-1); musicQueueIndexRef.current = -1
    event.target.value = ''
  }
  const playNextMusicTrack = () => {
    if (playbackMode === 'repeat' && playerAudioRef.current) {
      playerAudioRef.current.currentTime = 0
      playerAudioRef.current.play().catch(() => {})
      return
    }
    const nextIndex = playbackMode === 'shuffle' && musicQueueRef.current.length > 1
      ? Math.floor(Math.random() * musicQueueRef.current.length)
      : musicQueueIndexRef.current + 1
    const nextTrack = musicQueueRef.current[nextIndex]
    if (!nextTrack) return
    setMusicQueueIndex(nextIndex); musicQueueIndexRef.current = nextIndex
    const nextPlayerTrack = { title: `${nextTrack.title} · ${nextTrack.artist}`, url: nextTrack.previewUrl, source: nextTrack, native: nextTrack.previewUrl?.startsWith('content://') }
    setPlayerTrack(nextPlayerTrack)
    if (nextPlayerTrack.native) window.CaregiversMusic?.playLocal?.(nextTrack.previewUrl, nextPlayerTrack.title, nextTrack.artist)
  }
  const playPreviousMusicTrack = () => {
    const previousIndex = Math.max(0, musicQueueIndexRef.current - 1)
    const previousTrack = musicQueueRef.current[previousIndex]
    if (!previousTrack) return
    setMusicQueueIndex(previousIndex); musicQueueIndexRef.current = previousIndex
    const nextPlayerTrack = { title: `${previousTrack.title} · ${previousTrack.artist}`, url: previousTrack.previewUrl, source: previousTrack, native: previousTrack.previewUrl?.startsWith('content://') }
    setPlayerTrack(nextPlayerTrack)
    if (nextPlayerTrack.native) window.CaregiversMusic?.playLocal?.(previousTrack.previewUrl, nextPlayerTrack.title, previousTrack.artist)
  }
  const changePlaybackMode = mode => { setPlaybackMode(mode); localStorage.setItem('caregivers-playback-mode', mode) }
  const removeMusicHistory = id => {
    const next = musicHistory.filter(track => track.id !== id)
    setMusicHistory(next)
    localStorage.setItem('caregivers-music-history', JSON.stringify(next))
  }
  const downloadMedia = async (url, name = 'caregivers-media') => {
    if (!url || mediaDownloading) return
    setMediaDownloading(true)
    try {
      const response = await mediaAPI.download({ url, name })
      const fileUrl = resolveMediaUrl(response.data.fileUrl)
      const link = document.createElement('a'); link.href = fileUrl; link.download = response.data.fileName || `${name}.mp3`; link.click()
      setPlayerTrack({ title: name, url: fileUrl, source: null })
    } catch (error) { alert(error.response?.data?.error || 'Download failed') }
    finally { setMediaDownloading(false) }
  }
  const openLockSettings = () => window.dispatchEvent(new Event('caregivers:app-lock-settings'))
  const openOfficialTrack = track => {
    if (!track?.storeUrl) return
    window.open(track.storeUrl, '_blank', 'noopener,noreferrer')
  }
  useEffect(() => {
    window.CaregiversMusicError = message => alert(message || 'Audio ဖွင့်မရပါ')
    window.CaregiversMusicCommand = command => {
      const audio = playerAudioRef.current
      if (command === 'stop') { audio?.pause(); window.CaregiversMusic?.stop?.(); setPlayerTrack(null); return }
      if (playerTrack?.native) { if (command === 'play') window.CaregiversMusic?.resume?.(); if (command === 'pause') window.CaregiversMusic?.pause?.(); if (command === 'next') playNextMusicTrack(); if (command === 'previous') playPreviousMusicTrack(); return }
      if (!audio) return
      if (command === 'play') audio.play().catch(() => {})
      if (command === 'pause') audio.pause()
      if (command === 'next') playNextMusicTrack()
      if (command === 'previous') playPreviousMusicTrack()
    }
    return () => { delete window.CaregiversMusicCommand; delete window.CaregiversMusicError }
  })

  const existingMemberIds = new Set((activeChat?.data?.members || []).map(member => member.userId || member.id || member.user?.id))
  const memberCandidates = [...friends, ...conversations.map(conversation => conversation.otherUser || conversation.user).filter(Boolean)].filter(candidate => candidate?.id && candidate.id !== user?.id && !existingMemberIds.has(candidate.id)).filter((candidate, index, list) => list.findIndex(item => item.id === candidate.id) === index)

  return (
    <div className={`h-[100dvh] w-screen max-w-full overflow-hidden flex ${dark ? 'dark' : ''}`}>
      {/* Sidebar */}
      <div className={`${activeChat ? 'hidden md:flex' : 'flex'} w-16 md:w-20 shrink-0 bg-sky-600 dark:bg-gray-900 flex-col items-center py-3 gap-2 overflow-y-auto overscroll-contain`}>
        <img src="/favicon.jpg" alt="" className="w-10 h-10 rounded-full object-cover" />
        <button onClick={() => setTab('chats')} className={`relative p-3 rounded-xl ${tab === 'chats' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}>
          <MessageCircle size={22} />{unreadChatCount > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">{unreadChatCount > 99 ? '99+' : unreadChatCount}</span>}
        </button>
        <button onClick={() => setTab('groups')} className={`relative p-3 rounded-xl ${tab === 'groups' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}>
          <Users size={22} />{groups.reduce((sum, group) => sum + (group.unreadCount || 0), 0) > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">{groups.reduce((sum, group) => sum + (group.unreadCount || 0), 0) > 99 ? '99+' : groups.reduce((sum, group) => sum + (group.unreadCount || 0), 0)}</span>}
        </button>
        <button onClick={() => { setTab('search'); handleSearch() }} className={`p-3 rounded-xl ${tab === 'search' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}>
          <Search size={22} />
        </button>
        <button onClick={() => { setTab('friends'); setActiveChat(null); setMessages([]); loadFriends(); loadFriendRequests() }} className={`p-3 rounded-xl ${tab === 'friends' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`} title="Friends">
          <UserPlus size={22} />
        </button>
        <button onClick={openAdminNotifications} className={`relative p-3 rounded-xl ${tab === 'admin-noti' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`} title="From Admin Noti">
          <Bell size={22} />
          {unreadNotificationCount > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}
        </button>
        <button onClick={() => { setTab('ai-chat'); setActiveChat(null); setMessages([]); loadAiConversations() }} className={`p-3 rounded-xl ${tab === 'ai-chat' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`} title="AI Chat">
          <Bot size={22} />
        </button>
        <button onClick={() => { setTab('call-history'); setActiveChat(null); setMessages([]); loadCallHistory() }} className={`p-3 rounded-xl ${tab === 'call-history' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`} title="Call history">
          <Phone size={22} />
        </button>
        <button onClick={() => { setTab('wallet'); setActiveChat(null); setMessages([]); loadWallet() }} className={`p-3 rounded-xl ${tab === 'wallet' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}>
          <Wallet size={22} />
        </button>
        <button onClick={() => { setTab('feed'); setActiveChat(null); setMessages([]); loadPosts() }} className={`p-3 rounded-xl ${tab === 'feed' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`} title="Feed">
          <Rss size={22} />
        </button>
        <button onClick={() => { setTab('music'); setActiveChat(null); setMessages([]) }} className={`p-3 rounded-xl ${tab === 'music' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`} title="Music Player">
          <Music2 size={22} />
        </button>
        <button onClick={() => { setTab('downloader'); setActiveChat(null); setMessages([]) }} className={`p-3 rounded-xl ${tab === 'downloader' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`} title="Downloader">
          <DownloadCloud size={22} />
        </button>
        <div className="h-2 shrink-0" />
        <button onClick={() => { setTab('profile'); setActiveChat(null); setMessages([]) }} className={`p-3 rounded-xl ${tab === 'profile' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`} title="Profile">
          <UserCircle size={22} />
        </button>
        <button onClick={() => setShowDeveloper(true)} className="p-3 text-white/70 hover:bg-white/10 rounded-xl" title="Developer">
          <Code2 size={20} />
        </button>
        <button onClick={toggleDark} className="p-3 text-white/70 hover:bg-white/10 rounded-xl">
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button onClick={openLockSettings} className="p-3 text-white/70 hover:bg-white/10 rounded-xl" title="App Lock">
          <LockKeyhole size={20} />
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
      <div className={`${activeChat ? 'hidden md:flex' : 'flex'} flex-1 min-w-0 md:flex-none md:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col`}>
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="font-bold text-lg text-gray-800 dark:text-white">
            {tab === 'chats' && t('chats')}
            {tab === 'groups' && t('groups')}
            {tab === 'search' && t('searchFriend')}
            {tab === 'wallet' && t('wallet')}
            {tab === 'feed' && 'Feed'}
            {tab === 'music' && 'Music Player'}
            {tab === 'downloader' && 'Downloader'}
            {tab === 'profile' && 'Profile'}
            {tab === 'friends' && 'Friends'}
            {tab === 'admin-noti' && 'From Admin Noti'}
            {tab === 'ai-chat' && 'AI Chat'}
            {tab === 'call-history' && 'Call History'}
          </h2>
          <p className="text-xs text-gray-500">{user?.displayName || user?.username}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'feed' && <FeedPanel user={user} posts={posts} onRefresh={loadPosts} onTranslate={text => translateText(`post-${text.slice(0, 80)}`, text)} onShareToChat={sharePostToChat} onReportPost={post => openReport('post', { targetPostId: post.id, content: post.caption || post.mediaUrl || 'Post' })} />}
          {tab === 'profile' && <ProfilePanel user={user} setUser={setUser} posts={posts} onRefreshPosts={loadPosts} />}
          {tab === 'friends' && <div className="p-3 space-y-4">
            <section><h3 className="font-bold dark:text-white mb-2">Friends ({friends.length})</h3>{friends.length === 0 && <p className="text-sm text-gray-500">No friends yet</p>}{friends.map(friend => <div key={friend.id} className="p-2 flex items-center gap-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"><div className="w-9 h-9 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold">{(friend.displayName || friend.username)[0].toUpperCase()}</div><div className="flex-1 min-w-0"><p className="text-sm font-medium dark:text-white truncate">{friend.displayName || friend.username}</p><p className="text-xs text-gray-500">@{friend.username}</p></div><button onClick={() => openPrivateChat(friend)} className="p-2 text-sky-500"><MessageCircle size={17} /></button></div>)}</section>
            <section><h3 className="font-bold dark:text-white mb-2">Friend Requests ({friendRequests.length})</h3>{friendRequests.length === 0 && <p className="text-sm text-gray-500">No pending requests</p>}{friendRequests.map(request => <div key={request.id} className="p-2 flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-700"><div className="flex-1"><p className="text-sm font-medium dark:text-white">{request.fromUser?.displayName || request.fromUser?.username}</p><p className="text-xs text-gray-500">wants to be your friend</p></div><button onClick={() => respondToFriendRequest(request.id, 'accept')} className="px-2 py-1 text-xs rounded bg-green-500 text-white">Accept</button><button onClick={() => respondToFriendRequest(request.id, 'decline')} className="px-2 py-1 text-xs rounded bg-red-500 text-white">Decline</button></div>)}</section>
          </div>}
          {tab === 'admin-noti' && <div className="p-3 space-y-3">
            {notifications.length === 0 && <div className="rounded-xl bg-gray-50 dark:bg-gray-700 p-5 text-center text-sm text-gray-500">Admin notification မရှိသေးပါ</div>}
            {notifications.map(notification => <article key={notification.id} className="rounded-xl border border-sky-100 dark:border-gray-600 bg-sky-50 dark:bg-gray-700 p-4 shadow-sm"><div className="flex items-start gap-3"><div className="p-2 rounded-full bg-sky-500 text-white"><Bell size={17} /></div><div className="min-w-0 flex-1"><h3 className="font-bold text-sky-700 dark:text-sky-300">{notification.title || 'From Admin'}</h3><p className="mt-1 text-sm whitespace-pre-wrap dark:text-gray-200">{notification.message}</p>{translations[`notification-${notification.id}`] && <p className="mt-2 rounded-lg bg-white/60 p-2 text-sm whitespace-pre-wrap dark:bg-gray-800/60 dark:text-sky-100">{translations[`notification-${notification.id}`]}</p>}<button type="button" onClick={() => translateText(`notification-${notification.id}`, notification.message)} className="mt-2 text-xs text-sky-600 dark:text-sky-300">{translatingKey === `notification-${notification.id}` ? 'ဘာသာပြန်နေသည်…' : 'မြန်မာလိုပြန်ရန်'}</button><p className="mt-2 text-xs text-gray-500">{new Date(notification.createdAt).toLocaleString()}</p></div></div></article>)}
          </div>}
          {tab === 'ai-chat' && <div className="flex h-full min-h-0 flex-col p-3">
            <div className="mb-3 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 p-4 text-white"><div className="flex items-center gap-2 font-bold"><Bot size={20} /> Caregivers AI <button type="button" onClick={createNewAiChat} className="ml-auto rounded-lg bg-white/15 px-2 py-1 text-xs hover:bg-white/25">+ New chat</button></div><p className="mt-1 text-xs text-white/80">Account နဲ့သိမ်းထားတဲ့ chat ကို ပြန်ဖွင့်ပြီး ဆက်ပြောနိုင်ပါတယ်။</p></div>
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{aiConversations.map(conversation => <div key={conversation.id} className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${activeAiConversationId === conversation.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200' : 'dark:border-gray-600 dark:text-gray-200'}`}><button type="button" onClick={() => selectAiChat(conversation.id)} className="max-w-32 truncate">{conversation.title}</button><button type="button" onClick={() => deleteAiChat(conversation.id)} className="text-gray-400 hover:text-red-500">×</button></div>)}</div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl bg-gray-50 p-3 dark:bg-gray-700">{aiMessages.length === 0 && <p className="py-10 text-center text-sm text-gray-500">AI ကို မေးချင်တာရေးပါ…</p>}{aiMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className="group max-w-[85%]"><div className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.role === 'user' ? 'bg-sky-500 text-white' : 'bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-100'}`}>{message.content}</div><button type="button" onClick={() => copyAiMessage(message.content)} className="mt-1 px-1 text-[11px] text-gray-400 hover:text-indigo-500">Copy</button></div></div>)}{aiSending && <div className="text-xs text-gray-500">AI စဉ်းစားနေသည်…</div>}</div>
            <form onSubmit={sendAiMessage} className="mt-3 flex gap-2"><input value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="AI ကို မေးပါ…" className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /><button disabled={aiSending || !aiInput.trim()} className="rounded-full bg-indigo-500 px-4 py-2 text-white disabled:opacity-50"><Send size={16} /></button></form>
          </div>}
          {tab === 'music' && <div className="p-3 space-y-5"><section><div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2 font-semibold dark:text-white"><Music2 size={18} className="text-emerald-500" /> Phone Music Player</div><button onClick={() => window.CaregiversLocalMusic?.refresh?.()} className="rounded-lg border px-2 py-1 text-xs text-emerald-600 dark:border-gray-600">Refresh</button></div><p className="mb-2 text-xs text-gray-500">ဖုန်းထဲက Music library ကို App ထဲမှာ ပြပြီး ဒီထဲမှာပဲ ဖွင့်ပါမယ်။</p>{localSongs.length === 0 && <p className="mt-4 text-center text-xs text-red-500">သီချင်းမတွေ့ပါ။ Refresh နှိပ်ပြီး Music and audio permission ကို စစ်ပါ။</p>}{localSongs.length > 0 && <div className="mt-3 space-y-1">{localSongs.map(song => <button key={song.id} onClick={() => playMusicTrack(song, localSongs)} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-emerald-50 dark:border-gray-600 dark:hover:bg-gray-700"><Play size={17} className="text-emerald-500" /><span className="min-w-0 flex-1 truncate text-sm dark:text-gray-200">{song.title}</span><span className="text-xs text-gray-500">{song.artist}</span></button>)}</div>}</section>{musicHistory.length > 0 && <section><p className="mb-2 text-sm font-semibold dark:text-white">Previous queue</p><div className="space-y-1">{musicHistory.slice(0, 10).map(track => <div key={track.id} className="flex items-center gap-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"><button onClick={() => playMusicTrack(track, musicHistory)} className="flex min-w-0 flex-1 items-center gap-2 p-2 text-left"><span className="min-w-0 flex-1 truncate text-xs dark:text-gray-200">{track.title} · {track.artist}</span><Play size={14} className="text-green-500" /></button><button onClick={() => removeMusicHistory(track.id)} className="p-2 text-red-400" title="Delete history"><Trash2 size={14} /></button></div>)}</div></section>}</div>}
          {tab === 'downloader' && <div className="p-3 space-y-5"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">သတိပေးချက် — သင်ပိုင်ဆိုင်သော သို့မဟုတ် download လုပ်ခွင့်ရှိသော media ပဲ အသုံးပြုပါ။ Social media တွေမှာ ပြန်တင်ရင် Copyright မိနိုင်ပါတယ်။</div><section><div className="mb-2 flex items-center gap-2 font-semibold dark:text-white"><DownloadCloud size={18} className="text-indigo-500" /> Video / Audio Downloader</div><p className="mb-2 text-xs text-gray-500">TikTok public link ထည့်ရင် watermark မပါသော video ကို download လုပ်ပေးမယ်။ အခြားဆိုဒ်တွေကတော့ direct audio/video file link သုံးပါ။</p><div className="flex gap-2"><input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://www.tiktok.com/@user/video/..." className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /><button onClick={() => downloadMedia(mediaUrl, 'tiktok-video')} disabled={mediaDownloading} className="rounded-xl bg-indigo-500 px-3 text-white disabled:opacity-50">{mediaDownloading ? '...' : 'Start'}</button></div></section></div>}
          {tab === 'call-history' && <div className="p-3 space-y-2">{callHistory.length === 0 && <p className="text-sm text-gray-500">Call history မရှိသေးပါ</p>}{callHistory.map(item => { const other = item.callerId === user.id ? item.receiver : item.caller; return <div key={item.id} className="rounded-xl border dark:border-gray-600 p-3 flex items-center gap-3"><Phone size={18} className="text-sky-500" /><div className="flex-1"><p className="text-sm font-medium dark:text-white">{other?.displayName || other?.username}</p><p className="text-xs text-gray-500">{item.callType} call · {item.status} · {new Date(item.createdAt).toLocaleString()}</p></div></div> })}</div>}
          {tab === 'chats' && conversations.map(c => (
            <div key={c.id} onClick={() => openPrivateChat(c.otherUser, c.id)} onContextMenu={e => { e.preventDefault(); setConversationToDelete(c) }} onTouchStart={() => beginConversationLongPress(c)} onTouchEnd={cancelConversationLongPress} onTouchMove={cancelConversationLongPress}
              className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${activeChat?.id === c.id ? 'bg-sky-50 dark:bg-sky-900/30' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold">
                {(c.otherUser?.displayName || c.otherUser?.username || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate dark:text-white">{c.otherUser?.displayName || c.otherUser?.username}</p>
                <p className="text-xs text-gray-500 truncate">{c.lastMessage?.content || ''}</p>
              </div>
              {c.unreadCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">{c.unreadCount > 99 ? '99+' : c.unreadCount}</span>}
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
                  <button onClick={e => { e.stopPropagation(); showGroupInfo(g) }} className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold overflow-hidden">
                    {g.icon ? <img src={resolveMediaUrl(g.icon)} alt="" className="w-full h-full object-cover" /> : g.name[0].toUpperCase()}
                  </button>
                  <div className="flex-1">
                    <p className="font-medium text-sm dark:text-white">{g.name}</p>
                    <p className="text-xs text-gray-500">{g.members?.length || 0} {t('members')}</p>
                  </div>
                  {g.unreadCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">{g.unreadCount > 99 ? '99+' : g.unreadCount}</span>}
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
                  <button onClick={() => showUserProfile(u)} className="shrink-0">
                    {u.avatar ? <img src={resolveMediaUrl(u.avatar)} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold text-sm">{(u.displayName || u.username)[0].toUpperCase()}</div>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => showUserProfile(u)} className="text-sm font-medium dark:text-white truncate text-left">{u.displayName || u.username}</button>
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

              {paymentAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm dark:text-white">{t('paymentInfo')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {paymentAccounts.map(account => (
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
      <div className={`${activeChat ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col bg-gray-50 dark:bg-gray-900`}>
        {activeChat ? (
          <>
            <div className="relative h-14 shrink-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
              <button onClick={() => { setActiveChat(null); setMessages([]) }} className="md:hidden p-2 text-gray-500" aria-label="Back">
                <ArrowLeft size={20} />
              </button>
              <button onClick={() => activeChat.type === 'private' ? showUserProfile(activeChat.data) : showGroupInfo(activeChat.data)} className="w-9 h-9 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold overflow-hidden">
                {activeChat.data?.avatar ? <img src={resolveMediaUrl(activeChat.data.avatar)} alt="" className="w-full h-full object-cover" /> : activeChat.data?.icon ? <img src={resolveMediaUrl(activeChat.data.icon)} alt="" className="w-full h-full object-cover" /> : (activeChat.data?.displayName || activeChat.data?.name || activeChat.data?.username || '?')[0].toUpperCase()}
              </button>
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
              {activeChat.type === 'group' && (
                <>
                  <button onClick={() => startGroupCall('audio')} disabled={Boolean(groupCall)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full disabled:opacity-40" title="Group voice call"><Phone size={18} /></button>
                  <button onClick={() => startGroupCall('video')} disabled={Boolean(groupCall)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full disabled:opacity-40" title="Group video call"><Video size={18} /></button>
                </>
              )}
              <button onClick={() => setShowBackgrounds(v => !v)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="Chat background"><Settings size={18} /></button>
              {showBackgrounds && <div className="absolute right-3 top-12 z-20 bg-white dark:bg-gray-800 border rounded-xl shadow p-3 flex flex-wrap gap-2 w-64">
                {['', 'bg-sky-50', 'bg-rose-50', 'bg-emerald-50', 'bg-amber-50'].map(bg => <button key={bg || 'default'} onClick={() => { setChatBackground(bg); setChatBackgroundImage(''); localStorage.setItem(`chat-bg-${activeChat.id}`, bg); localStorage.removeItem(`chat-bg-image-${activeChat.id}`); setShowBackgrounds(false) }} className={`w-7 h-7 rounded-full border ${bg || 'bg-gray-50'}`} />)}
                <label className="w-full mt-1 px-3 py-2 rounded-lg bg-sky-500 text-white text-sm text-center cursor-pointer">Choose phone photo
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const image = String(reader.result); setChatBackgroundImage(image); setChatBackground(''); localStorage.setItem(`chat-bg-image-${activeChat.id}`, image); localStorage.removeItem(`chat-bg-${activeChat.id}`); setShowBackgrounds(false) }; reader.readAsDataURL(file) }} />
                </label>
                {chatBackgroundImage && <button onClick={() => { setChatBackgroundImage(''); localStorage.removeItem(`chat-bg-image-${activeChat.id}`); setShowBackgrounds(false) }} className="w-full text-xs text-red-500">Remove photo</button>}
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
                <button onClick={() => { setSelectedMemberIds([]); setShowAddMembers(true) }} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="Add members"><UserPlus size={18} /></button>
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

            <div className={`min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 ${chatBackground} ${chatBackgroundImage ? 'bg-cover bg-center bg-no-repeat' : ''}`} style={chatBackgroundImage ? { backgroundImage: `linear-gradient(rgba(255,255,255,.78),rgba(255,255,255,.78)), url(${chatBackgroundImage})` } : undefined}>
              {messages.length === 0 && (
                <p className="text-center text-gray-400 text-sm mt-10">{t('noMessages')}</p>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                  <div data-message-menu className="relative group max-w-[85%]" onContextMenu={e => { e.preventDefault(); setMessageMenu(m.id) }} onTouchStart={e => { swipeStartXRef.current = e.touches[0].clientX; beginMessageLongPress(m) }} onTouchEnd={e => { cancelMessageLongPress(); if (Math.abs(e.changedTouches[0].clientX - swipeStartXRef.current) > 60) setReplyTarget(m) }} onTouchMove={cancelMessageLongPress} onTouchCancel={cancelMessageLongPress}>
                  <div className={`max-w-full px-4 py-2 rounded-2xl text-sm ${
                    m.senderId === user.id
                      ? 'bg-sky-500 text-white rounded-br-md'
                      : 'bg-white dark:bg-gray-700 dark:text-white rounded-bl-md shadow-sm'
                  }`}>
                    {activeChat.type === 'group' && m.senderId !== user.id && (
                      <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 mb-0.5">{m.sender?.displayName || m.sender?.username}</p>
                    )}
                    {m.type === 'deleted' ? <p className="italic opacity-70">This message was deleted</p>
                      : ['call', 'missed_call', 'declined_call', 'call_ended'].includes(m.type) ? <div className="flex items-center gap-2 font-medium"><Phone size={18} className={m.type === 'missed_call' ? 'text-red-400' : 'text-sky-200'} /><span>{m.content || (m.type === 'missed_call' ? '❌ Missed call' : 'Call')}</span></div>
                      : m.type === 'profile' ? <ProfileMessageCard profile={getProfileMessageData(m)} onOpen={() => { const profile = getProfileMessageData(m); if (profile) showUserProfile(profile) }} />
                      : m.type === 'sticker' && m.fileUrl ? <img src={resolveMediaUrl(m.fileUrl)} alt="Sticker" className="h-auto max-h-24 w-auto max-w-24 rounded-xl object-contain" />
                      : m.type === 'image' && m.fileUrl ? <><img src={resolveMediaUrl(m.fileUrl)} alt={m.content || 'Image'} className="max-w-full rounded-lg" /><a href={resolveMediaUrl(m.fileUrl)} download={m.content || 'image'} className="mt-1 inline-flex items-center gap-1 text-xs underline"><Download size={13} /> Save image</a></>
                      : m.type === 'video' && m.fileUrl ? <><video src={resolveMediaUrl(m.fileUrl)} controls className="max-w-full rounded-lg" /><a href={resolveMediaUrl(m.fileUrl)} download={m.content || 'video'} className="mt-1 inline-flex items-center gap-1 text-xs underline"><Download size={13} /> Save video</a></>
                      : m.type === 'audio' && m.fileUrl ? <audio src={resolveMediaUrl(m.fileUrl)} controls />
                      : m.type === 'file' && m.fileUrl ? <a href={resolveMediaUrl(m.fileUrl)} download={m.content || 'file'} className="inline-flex items-center gap-1 underline"><Download size={14} /> {m.content || 'Download file'}</a>
                      : m.type === 'location' ? <a href={m.content.split('\n').pop()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><MapPin size={16} /> Open location</a>
                      : <>{String(m.content || '').includes('\n') && String(m.content).startsWith('↪') ? <div className="mb-1 border-l-2 border-current/40 pl-2 text-xs opacity-60 whitespace-pre-wrap">{String(m.content).split('\n')[0]}</div> : null}<p className={m.type === 'sticker' ? 'text-5xl' : ''}>{String(m.content || '').includes('\n') && String(m.content).startsWith('↪') ? String(m.content).split('\n').slice(1).join('\n') : m.content}</p></>}{translations[`message-${m.id}`] && <p className="mt-2 rounded-lg bg-black/10 p-2 text-xs whitespace-pre-wrap">{translations[`message-${m.id}`]}</p>}
                    <p className={`text-[10px] mt-1 ${m.senderId === user.id ? 'text-sky-100' : 'text-gray-400'}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{m.senderId === user.id && <span className="ml-1">{m.pending ? 'Sending…' : m.messageStatus === 'seen' ? 'Seen' : m.messageStatus === 'delivered' || m.messageStatus === 'sent' ? 'Sent' : 'Sending…'}</span>}
                    </p>
                  </div>
                  {messageMenu === m.id && <div className={`absolute z-20 top-8 ${m.senderId === user.id ? 'right-0' : 'left-0'} bg-white dark:bg-gray-800 border rounded-xl shadow-lg p-1 min-w-32 text-xs dark:text-white`}>
                    {['share', 'forward', 'copy', 'report', ...(m.type === 'sticker' ? ['add sticker'] : []), ...(['text', 'call', 'missed_call', 'declined_call', 'call_ended'].includes(m.type) && m.content ? ['translate'] : []), ...(m.senderId === user.id && m.type !== 'deleted' ? ['edit', 'delete'] : [])].map(action => <button key={action} onClick={() => action === 'add sticker' ? stickerFromMessage(m) : action === 'translate' ? translateMessage(m) : handleMessageAction(action, m)} className={`block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 capitalize ${action === 'report' ? 'text-red-500' : ''}`}>{action === 'add sticker' ? 'Add My Sticker List' : action === 'translate' ? (translatingKey === `message-${m.id}` ? 'ဘာသာပြန်နေသည်…' : 'မြန်မာလိုပြန်ရန်') : action}</button>)}
                  </div>}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 p-2 sm:p-3 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex gap-1 sm:gap-2 items-center relative">
              {replyTarget && <div className="absolute -top-12 left-2 right-2 flex items-center justify-between rounded-lg bg-sky-50 dark:bg-sky-900/40 px-3 py-2 text-xs text-sky-700 dark:text-sky-200"><span className="truncate">Replying to: {replyTarget.content || 'message'}</span><button type="button" onClick={() => setReplyTarget(null)}><X size={15} /></button></div>}
              <input ref={chatFileRef} type="file" accept="image/*,video/*,audio/*,.pdf" className="hidden" onChange={() => sendMessage()} />
              <input ref={stickerFileRef} type="file" accept="image/*" className="hidden" onChange={createStickerFromImage} />
              <button onClick={() => chatFileRef.current?.click()} className="p-2 text-gray-500" title="Attach file"><Paperclip size={19} /></button>
              <button type="button" onPointerDown={startVoiceRecording} onPointerUp={stopVoiceRecording} onPointerCancel={stopVoiceRecording} onPointerLeave={stopVoiceRecording} className={`p-2 select-none touch-none ${recordingVoice ? 'text-red-500 animate-pulse' : 'text-gray-500'}`} title="ဖိထားပြီး voice ပို့ရန်"><Mic size={19} /></button>
              <button onClick={sendLocation} className="p-2 text-gray-500" title="Send location"><MapPin size={19} /></button>
              <button onClick={() => { const next = !showStickers; setShowStickers(next); if (next) { messageInputRef.current?.blur(); window.CaregiversKeyboard?.hide?.() } else setTimeout(() => messageInputRef.current?.focus(), 0) }} className={`p-2 text-lg ${showStickers ? 'text-sky-500' : 'text-gray-500'}`} title="Sticker">☺</button>
              <textarea
                ref={messageInputRef}
                rows="1"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={t('typeMessage')}
                className="min-w-0 flex-1 resize-none px-3 sm:px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-2xl outline-none focus:ring-2 focus:ring-sky-400 dark:bg-gray-700 dark:text-white text-sm"
              />
              <button type="button" onClick={() => sendMessage()} className="p-2.5 bg-sky-500 text-white rounded-full hover:bg-sky-600">
                <Send size={18} />
              </button>
            </div>
            {showStickers && <div className="max-h-64 overflow-y-auto border-t bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex items-center gap-1 border-b dark:border-gray-700"><button type="button" onClick={() => setStickerTab('mine')} className={`flex-1 border-b-2 px-2 py-2 text-xs font-semibold ${stickerTab === 'mine' ? 'border-sky-500 text-sky-500' : 'border-transparent text-gray-400'}`}>My Sticker</button><button type="button" onClick={() => setStickerTab('other')} className={`flex-1 border-b-2 px-2 py-2 text-xs font-semibold ${stickerTab === 'other' ? 'border-sky-500 text-sky-500' : 'border-transparent text-gray-400'}`}>Other From Sticker</button></div>
              {stickerTab === 'mine' && <div className="mb-3 flex justify-end"><button type="button" onClick={() => stickerFileRef.current?.click()} className="rounded-lg bg-sky-500 px-2 py-1 text-xs text-white">Create from photo</button></div>}
              {(() => { const visibleStickers = myStickers.filter(sticker => stickerTab === 'other' ? sticker.source === 'other' : sticker.source !== 'other'); return <><div className="grid grid-cols-4 gap-2">{visibleStickers.map((sticker, index) => <button type="button" key={`${sticker.fileUrl}-${sticker.content}-${index}`} onClick={() => { if (stickerLongPressedRef.current) { stickerLongPressedRef.current = false; return } if (stickerMenuKey === stickerKey(sticker)) { setStickerMenuKey(null); return } sendSavedSticker(sticker) }} onContextMenu={event => { event.preventDefault(); setStickerMenuKey(stickerKey(sticker)) }} onTouchStart={() => beginStickerLongPress(sticker)} onTouchEnd={cancelStickerLongPress} onTouchCancel={cancelStickerLongPress} className="relative flex h-16 items-center justify-center rounded-lg bg-gray-100 p-1 hover:bg-sky-100 dark:bg-gray-700">{sticker.fileUrl ? <img src={resolveMediaUrl(sticker.fileUrl)} alt="" className="h-full w-full object-contain" /> : <span className="text-2xl">{sticker.content}</span>}{stickerMenuKey === stickerKey(sticker) && <span role="button" tabIndex={0} onClick={event => { event.stopPropagation(); deleteMySticker(sticker) }} className="absolute inset-x-1 bottom-1 rounded bg-red-600 py-0.5 text-[10px] text-white">Delete</span>}</button>)}</div>{visibleStickers.length === 0 && <p className="py-8 text-center text-xs text-gray-400">No saved stickers yet</p>}</> })()}
            </div>}
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
          <button onClick={() => { stopNotificationSound(); setLatestNotification(null) }} className="absolute top-2 right-3 text-gray-400"><X size={18} /></button>
          <p className="font-bold text-sky-600 dark:text-sky-300">📣 {latestNotification.title}</p>
          <p className="mt-1 text-sm dark:text-gray-200 whitespace-pre-wrap">{latestNotification.message}</p>{translations[`notification-${latestNotification.id || latestNotification.title}`] && <p className="mt-2 rounded-lg bg-sky-50 p-2 text-sm whitespace-pre-wrap dark:bg-sky-950/40 dark:text-sky-100">{translations[`notification-${latestNotification.id || latestNotification.title}`]}</p>}<button type="button" onClick={() => translateText(`notification-${latestNotification.id || latestNotification.title}`, latestNotification.message)} className="mt-2 text-xs text-sky-600 dark:text-sky-300">{translatingKey === `notification-${latestNotification.id || latestNotification.title}` ? 'ဘာသာပြန်နေသည်…' : 'မြန်မာလိုပြန်ရန်'}</button>
        </div>
      )}
      {latestMessageNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-white dark:bg-gray-800 border border-sky-200 rounded-2xl shadow-xl p-4">
          <button onClick={() => { stopNotificationSound(); setPopupReplying(false); setPopupReply(''); setLatestMessageNotification(null) }} className="absolute top-2 right-3 text-gray-400"><X size={18} /></button>
          <div className="flex items-start gap-3 pr-5"><div className="w-10 h-10 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold">{(latestMessageNotification.sender?.displayName || latestMessageNotification.sender?.username || '?')[0].toUpperCase()}</div><div className="min-w-0 flex-1"><p className="font-bold text-sky-600 dark:text-sky-300">{latestMessageNotification.sender?.displayName || latestMessageNotification.sender?.username || 'New message'}</p><p className="mt-1 text-sm dark:text-gray-200 truncate">{latestMessageNotification.content || (latestMessageNotification.type === 'audio' ? 'Voice message' : 'Attachment')}</p>{translations[`popup-message-${latestMessageNotification.id || latestMessageNotification.createdAt}`] && <p className="mt-2 rounded-lg bg-sky-50 p-2 text-sm whitespace-pre-wrap dark:bg-sky-950/40 dark:text-sky-100">{translations[`popup-message-${latestMessageNotification.id || latestMessageNotification.createdAt}`]}</p>}<button type="button" onClick={() => translateText(`popup-message-${latestMessageNotification.id || latestMessageNotification.createdAt}`, latestMessageNotification.content || '')} className="mt-2 text-xs text-sky-600 dark:text-sky-300">မြန်မာလိုပြန်ရန်</button>{!popupReplying ? <div className="mt-3 flex gap-2"><button onClick={replyToMessageNotification} className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm">Reply</button><button onClick={() => { stopNotificationSound(); openPrivateChat(latestMessageNotification.sender); setLatestMessageNotification(null) }} className="px-3 py-1.5 rounded-lg border border-sky-300 text-sky-600 dark:text-sky-300 text-sm">Open chat</button></div> : <form onSubmit={sendPopupReply} className="mt-3 flex gap-2"><input autoFocus value={popupReply} onChange={e => setPopupReply(e.target.value)} placeholder="Reply..." className="min-w-0 flex-1 px-3 py-2 rounded-lg border dark:bg-gray-700 dark:text-white" /><button disabled={sendingPopupReply} className="px-3 py-2 rounded-lg bg-sky-500 text-white disabled:opacity-60">{sendingPopupReply ? 'Sending...' : 'Send'}</button></form>}</div></div>
        </div>
      )}
      {sharePostTarget && <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4" onClick={() => setSharePostTarget(null)}><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-800" onClick={event => event.stopPropagation()}><div className="flex items-center justify-between"><h3 className="text-lg font-bold dark:text-white">Post to chat</h3><button type="button" onClick={() => setSharePostTarget(null)}><X size={18} /></button></div><p className="mt-1 truncate text-sm text-gray-500">{sharePostTarget.caption || 'Post'}</p><div className="mt-4 max-h-72 space-y-2 overflow-y-auto">{conversations.map(conversation => <button type="button" key={`private-${conversation.id}`} onClick={() => sendPostToChat({ type: 'private', id: conversation.id })} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"><UserCircle size={20} /><span>{conversation.otherUser?.displayName || conversation.otherUser?.username || 'Private chat'}</span></button>)}{groups.map(group => <button type="button" key={`group-${group.id}`} onClick={() => sendPostToChat({ type: 'group', id: group.id })} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"><Users size={20} /><span>{group.name}</span></button>)}{!conversations.length && !groups.length && <p className="py-8 text-center text-sm text-gray-400">Chat မရှိသေးပါ</p>}</div></div></div>}
      {reportTarget && (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4" onClick={() => setReportTarget(null)}>
          <form onSubmit={submitReport} onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-2xl">
            <div className="flex items-center gap-2"><Flag size={20} className="text-red-500" /><h3 className="text-lg font-bold dark:text-white">Report {reportTarget.type.replace('_', ' ')}</h3></div>
            {reportTarget.content && <p className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-700 p-3 text-sm text-gray-600 dark:text-gray-200 break-words">{reportTarget.content}</p>}
            <label className="mt-4 block text-sm font-medium dark:text-white">ဘာကြောင့်တိုင်တာလဲ?</label>
            <input value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="ဥပမာ - မသင့်လျော်သောစာ၊ Spam" className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
            <label className="mt-3 block text-sm font-medium dark:text-white">အသေးစိတ် (လိုအပ်ပါက)</label>
            <textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} rows="4" placeholder={reportTarget.type === 'app_error' ? 'ဖြစ်နေသော Error ကို အသေးစိတ်ရေးပါ' : 'အခြားအချက်အလက်များ ရေးပါ'} className="mt-1 w-full resize-none rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required={reportTarget.type === 'app_error'} />
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setReportTarget(null)} className="rounded-lg border px-4 py-2 dark:border-gray-600 dark:text-white">မလုပ်တော့</button><button disabled={reportSubmitting} className="rounded-lg bg-red-500 px-4 py-2 text-white disabled:opacity-60">{reportSubmitting ? 'တင်နေသည်...' : 'Report တင်မည်'}</button></div>
          </form>
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
            <div className="mt-6 flex justify-center gap-2"><button onClick={() => { setShowDeveloper(false); openReport('app_error') }} className="px-5 py-2 rounded-full bg-red-500/80 text-white font-semibold"><Flag size={15} className="inline mr-1" />App Error တိုင်ရန်</button><button onClick={() => setShowDeveloper(false)} className="px-5 py-2 rounded-full bg-white text-sky-700 font-semibold">ပိတ်မည်</button></div>
          </div>
        </div>
      )}
      {incomingCall && !call && (
        <div className="fixed inset-0 z-50 pointer-events-none p-3 sm:p-5">
          <div className="pointer-events-auto ml-auto mr-auto sm:mr-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm text-center shadow-2xl border border-sky-200 dark:border-gray-700">
            <p className="text-lg font-semibold dark:text-white mb-2">Incoming {incomingCall.callType} call</p>
            <p className="text-gray-500 mb-5">{incomingCall.fromUsername} is calling you</p>
            <div className="flex gap-3">
              <button onClick={() => { stopNotificationSound(); socket.emit('call:end', { toUserId: incomingCall.fromUserId, callId: incomingCall.callId, outcome: 'declined' }); setIncomingCall(null) }} className="flex-1 py-3 rounded-xl bg-red-500 text-white">Decline</button>
              <button onClick={acceptCall} className="flex-1 py-3 rounded-xl bg-green-500 text-white">Accept</button>
            </div>
          </div>
        </div>
      )}

      {call && (
        <div className="fixed inset-0 z-40 bg-gray-950 flex flex-col">
          <div className="flex-1 relative flex items-center justify-center">
            <video ref={remoteVideoRef} autoPlay muted={call.callType === 'audio'} playsInline className={`absolute inset-0 w-full h-full object-cover bg-black ${call.callType === 'audio' ? 'hidden' : ''}`} />
            <audio ref={remoteAudioRef} autoPlay className={call.callType === 'audio' ? 'block' : 'hidden'} />
            <video
              ref={localVideoRef}
              autoPlay muted playsInline
              style={{ filter: videoEffectPipelineRef.current ? 'none' : getVideoEffect(videoEffect).filter }} className={`absolute right-4 top-4 w-28 h-40 sm:w-40 sm:h-56 object-cover rounded-xl border-2 border-white ${call.callType === 'audio' || cameraOff ? 'hidden' : ''}`}
            />
            <div className="absolute top-4 left-4 rounded-lg bg-black/60 px-3 py-2 text-white text-sm">{callStatus || 'Calling'}</div>
            {call.callType === 'audio' && <p className="text-white text-xl">Voice call in progress</p>}
          </div>
          <div className="p-4 flex flex-wrap items-center justify-center gap-3 bg-gray-900">
            <select value={audioRoute} onChange={e => changeAudioRoute(e.target.value)} className="px-3 py-2 rounded-lg bg-gray-700 text-white text-sm" aria-label="Audio output">
              <option value="earpiece">Ear</option><option value="speaker">Speaker</option><option value="bluetooth">Bluetooth</option>
            </select>
            <button onClick={toggleMute} className="p-4 rounded-full bg-gray-700 text-white" title="Mute">
              {mutedCall ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            {call.callType === 'video' && <div className="relative"><button onClick={() => setShowVideoEffects(value => !value)} className="flex items-center gap-2 rounded-xl bg-gray-700 px-3 py-2 text-sm text-white" title="Video effects"><Sparkles size={16} /> {getVideoEffect(videoEffect).label}</button>{showVideoEffects && <div className="absolute bottom-16 left-1/2 z-50 flex w-[min(92vw,560px)] -translate-x-1/2 gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-gray-900/95 p-2 shadow-2xl backdrop-blur overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>{VIDEO_EFFECTS.map(effect => <button type="button" key={effect.id} onClick={() => applyVideoEffect(effect.id)} className={`flex min-w-[68px] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] text-white transition hover:bg-white/15 ${videoEffect === effect.id ? 'bg-sky-500' : ''}`}><span className="text-xl leading-none">{effect.emoji}</span><span>{effect.id === 'none' ? 'Normal' : effect.label}</span></button>)}</div>}</div>}
            {call.callType === 'video' && <button onClick={toggleCamera} className="p-4 rounded-full bg-gray-700 text-white" title="Camera">
              {cameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>}
            {call.callType === 'video' && <button onClick={switchCamera} className="p-4 rounded-full bg-gray-700 text-white" title="Switch camera"><RefreshCw size={22} /></button>}
            <button onClick={() => endCall(true)} className="p-4 rounded-full bg-red-600 text-white" title="End call"><PhoneOff size={22} /></button>
          </div>
        </div>
      )}
      {groupCall && (
        <div className="fixed inset-0 z-40 flex flex-col bg-gray-950">
          <div className={`min-h-0 flex-1 gap-2 overflow-y-auto p-3 ${groupCall.callType === 'video' ? 'grid grid-cols-2 sm:grid-cols-3' : 'flex flex-col items-center justify-center'}`}>
            <div className={`relative overflow-hidden rounded-2xl bg-gray-800 ${groupCall.callType === 'video' ? 'min-h-48' : 'flex h-32 w-32 items-center justify-center rounded-full'}`}>
              {groupCall.callType === 'video' ? <video autoPlay muted playsInline ref={node => { if (node && groupLocalStreamRef.current) node.srcObject = groupLocalStreamRef.current }} className={`h-full min-h-48 w-full object-cover ${groupCameraOff ? 'hidden' : ''}`} /> : <Mic size={32} className="text-white" />}
              <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">You</span>
            </div>
            {groupParticipants.map(participant => <div key={participant.userId} className={`relative overflow-hidden rounded-2xl bg-gray-800 ${groupCall.callType === 'video' ? 'min-h-48' : 'flex h-24 w-full max-w-sm items-center gap-3 px-5'}`}>
              {groupCall.callType === 'video' && participant.stream ? <video autoPlay playsInline ref={node => { if (node) node.srcObject = participant.stream }} className="h-full min-h-48 w-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500 text-xl font-bold text-white">{(participant.username || '?')[0].toUpperCase()}</div>}
              <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">{participant.username || 'Participant'}</span>
            </div>)}
            {!groupParticipants.length && <p className="col-span-full self-center text-center text-sm text-gray-400">Waiting for group members to join…</p>}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 bg-gray-900 p-4">
            <span className="mr-2 text-sm text-white">Group {groupCall.callType} call · {groupParticipants.length + 1}</span>
            <button onClick={toggleGroupMute} className={`rounded-full p-4 text-white ${groupMuted ? 'bg-red-600' : 'bg-gray-700'}`} title="Mute">{groupMuted ? <MicOff size={22} /> : <Mic size={22} />}</button>
            {groupCall.callType === 'video' && <button onClick={toggleGroupCamera} className={`rounded-full p-4 text-white ${groupCameraOff ? 'bg-red-600' : 'bg-gray-700'}`} title="Camera">{groupCameraOff ? <VideoOff size={22} /> : <Video size={22} />}</button>}
            <button onClick={endGroupCall} className="rounded-full bg-red-600 p-4 text-white" title="End group call"><PhoneOff size={22} /></button>
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
      {showAddMembers && (
        <div className="fixed inset-0 z-[65] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowAddMembers(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold dark:text-white">Add group members</h3><button onClick={() => setShowAddMembers(false)}><X size={20} /></button></div>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {memberCandidates.length === 0 && <p className="text-sm text-gray-500 text-center py-5">Friend or conversation user မရှိသေးပါ။</p>}
              {memberCandidates.map(candidate => <label key={candidate.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                <input type="checkbox" checked={selectedMemberIds.includes(candidate.id)} onChange={e => setSelectedMemberIds(ids => e.target.checked ? [...ids, candidate.id] : ids.filter(id => id !== candidate.id))} />
                {candidate.avatar ? <img src={resolveMediaUrl(candidate.avatar)} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-sky-200 flex items-center justify-center font-bold text-sky-700">{(candidate.displayName || candidate.username || '?')[0].toUpperCase()}</div>}
                <span className="dark:text-white">{candidate.displayName || candidate.username}</span>
              </label>)}
            </div>
            <button disabled={!selectedMemberIds.length || addingMembers} onClick={addSelectedMembers} className="w-full mt-4 py-3 rounded-xl bg-sky-500 text-white font-semibold disabled:opacity-50">{addingMembers ? 'Adding...' : `Add selected (${selectedMemberIds.length})`}</button>
          </div>
        </div>
      )}
      {conversationToDelete && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setConversationToDelete(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold dark:text-white">Delete conversation?</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">ဒီ conversation တစ်ခုလုံးကို ဖျက်မလား။ OK နှိပ်မှသာ ဖျက်ပါမယ်။</p>
            <div className="mt-5 flex gap-3 justify-end">
              <button type="button" onClick={() => setConversationToDelete(null)} className="px-4 py-2 rounded-lg border dark:border-gray-600 dark:text-white">Cancel</button>
              <button type="button" onPointerDown={e => e.stopPropagation()} onClick={confirmDeleteConversation} className="px-4 py-2 rounded-lg bg-red-500 text-white">OK</button>
            </div>
          </div>
        </div>
      )}
      {selectedGroup && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedGroup(null)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-4">
              <label className="w-20 h-20 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 text-3xl font-bold overflow-hidden cursor-pointer">{selectedGroup.icon ? <img src={resolveMediaUrl(selectedGroup.icon)} alt="" className="w-full h-full object-cover" /> : selectedGroup.name?.[0]?.toUpperCase()}<input type="file" accept="image/*" className="hidden" onChange={setGroupIcon} /></label>
              <div><h3 className="text-xl font-bold dark:text-white">{selectedGroup.name}</h3><p className="text-sm text-gray-500">{selectedGroup.members?.length || 0} members</p></div>
            </div>
            {selectedGroup.description && <p className="mt-4 text-sm dark:text-gray-200 whitespace-pre-wrap">{selectedGroup.description}</p>}
            <h4 className="mt-5 mb-2 font-semibold dark:text-white">Members</h4>
            <div className="space-y-2">{(selectedGroup.members || []).map(member => <div key={member.userId} className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold">{(member.user?.displayName || member.user?.username || '?')[0].toUpperCase()}</div><div className="flex-1 min-w-0"><p className="text-sm dark:text-white truncate">{member.user?.displayName || member.user?.username}</p><p className="text-xs text-gray-500">{member.role}</p></div>{selectedGroup.myRole === 'admin' && member.userId !== user.id && <button onClick={() => removeGroupMember(member.userId)} className="px-2 py-1 text-xs rounded bg-red-100 text-red-600">Remove</button>}</div>)}</div>
            <div className="mt-6 flex gap-2"><button onClick={() => { setSelectedGroup(null); if (activeChat?.id !== selectedGroup.id) openGroupChat(selectedGroup) }} className="flex-1 py-2 rounded-lg bg-sky-500 text-white">Open chat</button>{selectedGroup.myRole === 'admin' && <button onClick={deleteGroup} className="px-3 py-2 rounded-lg bg-red-500 text-white">Delete</button>}<button onClick={() => setSelectedGroup(null)} className="px-3 py-2 rounded-lg border dark:border-gray-600 dark:text-white">Close</button></div>
          </div>
        </div>
      )}
      {selectedProfile && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedProfile(null)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 p-6 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            {selectedProfile.avatar ? <img src={resolveMediaUrl(selectedProfile.avatar)} alt="" className="w-28 h-28 rounded-full object-cover mx-auto border-4 border-sky-200" /> : <div className="w-28 h-28 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold text-4xl mx-auto">{(selectedProfile.displayName || selectedProfile.username || '?')[0].toUpperCase()}</div>}
            <h3 className="mt-4 text-xl font-bold dark:text-white">{selectedProfile.displayName || selectedProfile.username}</h3>
            <p className="text-sm text-gray-500">@{selectedProfile.username}</p>
            {selectedProfile.bio && <p className="mt-3 text-sm dark:text-gray-200 whitespace-pre-wrap">{selectedProfile.bio}</p>}
            <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => { openPrivateChat(selectedProfile); setSelectedProfile(null) }} className="flex-1 py-2 rounded-lg bg-sky-500 text-white">Message</button><button onClick={() => openProfileSharePicker(selectedProfile)} className="flex-1 py-2 rounded-lg bg-indigo-500 text-white">Share in chat</button><button onClick={() => { const text = `${selectedProfile.displayName || selectedProfile.username} @${selectedProfile.username}`; navigator.share ? navigator.share({ title: 'Caregivers profile', text }) : navigator.clipboard?.writeText(text); }} className="px-3 py-2 rounded-lg border dark:border-gray-600 dark:text-white">Share</button><button onClick={() => { openReport('user', { targetUserId: selectedProfile.id, content: selectedProfile.displayName || selectedProfile.username }); setSelectedProfile(null) }} className="px-3 py-2 rounded-lg border border-red-200 text-red-500">Report</button><button onClick={() => setSelectedProfile(null)} className="px-3 py-2 rounded-lg border dark:border-gray-600 dark:text-white">Close</button></div>
            <h4 className="mt-6 text-left font-semibold dark:text-white">Posts</h4>
            <div className="mt-2 space-y-3 text-left">{profilePosts.length === 0 ? <p className="text-sm text-gray-500">No posts yet</p> : profilePosts.map(post => <article key={post.id} className="rounded-xl border dark:border-gray-600 p-3"><p className="text-sm dark:text-gray-200 whitespace-pre-wrap">{post.caption}</p>{post.mediaUrl && <img src={resolveMediaUrl(post.mediaUrl)} alt="" className="mt-2 max-h-56 w-full object-cover rounded-lg" />}</article>)}</div>
          </div>
        </div>
      )}
      {profileShareTarget && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" onClick={() => setProfileShareTarget(null)}>
          <div className="w-full max-w-md max-h-[78vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold dark:text-white">Share profile in chat</h3><p className="text-xs text-gray-500">Choose who should receive this profile</p></div><button onClick={() => setProfileShareTarget(null)} className="p-1 text-gray-500"><X size={20} /></button></div>
            <div className="mt-4 flex gap-2"><input autoFocus value={profileShareSearch} onChange={e => setProfileShareSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchProfileShareUsers()} placeholder="Search recipient" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /><button onClick={searchProfileShareUsers} className="rounded-xl bg-indigo-500 px-3 text-white"><Search size={17} /></button></div>
            <div className="mt-4 max-h-[52vh] space-y-1 overflow-y-auto">{profileShareUsers.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No recipient found</p> : profileShareUsers.map(recipient => <button key={recipient.id} type="button" disabled={sharingProfile} onClick={() => shareProfileToUser(recipient)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-indigo-50 disabled:opacity-60 dark:hover:bg-gray-700">{recipient.avatar ? <img src={resolveMediaUrl(recipient.avatar)} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-200 font-bold text-sky-700">{(recipient.displayName || recipient.username || '?')[0].toUpperCase()}</div>}<span className="min-w-0 flex-1"><span className="block truncate font-semibold dark:text-white">{recipient.displayName || recipient.username}</span><span className="block truncate text-xs text-gray-500">@{recipient.username}</span></span><span className="text-xs font-semibold text-indigo-500">Send</span></button>)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
