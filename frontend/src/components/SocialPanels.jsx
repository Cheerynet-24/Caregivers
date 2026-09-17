import { useEffect, useRef, useState } from 'react'
import { postsAPI, userAPI, authAPI, reportsAPI, resolveMediaUrl } from '../services/api'
import { getSounds, saveSounds } from '../services/soundStore'
import { Heart, MessageCircle, Bookmark, Share2, Pencil, Trash2, UserCircle, ImagePlus, Send, X, Volume2, VolumeX, FileText, Download } from 'lucide-react'
import CommentModal from './CommentModal'
import MediaViewer from './MediaViewer'

const Avatar = ({ user, size = 'w-10 h-10' }) => user?.avatar
  ? <img src={resolveMediaUrl(user.avatar)} className={`${size} rounded-full object-cover`} alt="" />
  : <div className={`${size} rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold`}>{(user?.displayName || user?.username || '?')[0].toUpperCase()}</div>

const isVideoMedia = post => {
  const type = String(post?.mediaType || '').toLowerCase()
  const url = String(post?.mediaUrl || '').split('?')[0].toLowerCase()
  return type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(url)
}

export function ProfilePanel({ user, setUser, posts = [], onRefreshPosts }) {
  const [form, setForm] = useState({ username: user?.username || '', displayName: user?.displayName || '', bio: user?.bio || '', avatar: user?.avatar || '', allowMessagesFrom: user?.allowMessagesFrom || 'everyone', allowPostsFrom: user?.allowPostsFrom || 'everyone', showFriends: user?.showFriends !== false })
  const [savingProfile, setSavingProfile] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' })
  const [sound, setSound] = useState({})
  const avatarRef = useRef(null)
  useEffect(() => { getSounds().then(setSound) }, [])
  useEffect(() => setForm({ username: user?.username || '', displayName: user?.displayName || '', bio: user?.bio || '', avatar: user?.avatar || '', allowMessagesFrom: user?.allowMessagesFrom || 'everyone', allowPostsFrom: user?.allowPostsFrom || 'everyone', showFriends: user?.showFriends !== false }), [user])
  const saveProfile = async e => { e.preventDefault(); setSavingProfile(true); try { const res = await userAPI.updateProfile(form); setUser(res.data.user); alert('Profile saved') } catch (err) { alert(err.response?.data?.error || 'Profile update failed') } finally { setSavingProfile(false) } }
  const changePassword = async e => { e.preventDefault(); setChangingPassword(true); try { await authAPI.changePassword(password); setPassword({ currentPassword: '', newPassword: '' }); alert('Password changed') } catch (err) { alert(err.response?.data?.error || 'Password update failed') } finally { setChangingPassword(false) } }
  const pickAvatar = e => { const file = e.target.files?.[0]; if (!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = () => { const image = new Image(); image.onload = () => { const max = 320; const scale = Math.min(1, max / Math.max(image.width, image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); setForm(v => ({ ...v, avatar: canvas.toDataURL('image/jpeg', 0.78) })) }; image.src = reader.result }; reader.readAsDataURL(file) }
  const pickSound = (kind, e) => { const file = e.target.files?.[0]; if (!file || !file.type.startsWith('audio/')) return; const reader = new FileReader(); reader.onload = () => { const next = { ...sound, [kind]: reader.result }; setSound(next); saveSounds(next).catch(() => alert('အသံဖိုင်ကို သိမ်း၍မရပါ')) }; reader.readAsDataURL(file) }
  return <div className="p-4 space-y-4 overflow-y-auto">
    <div className="rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 p-5 text-white flex items-center gap-4"><Avatar user={{ ...user, avatar: form.avatar }} size="w-20 h-20" /><div><h2 className="text-xl font-bold">{user?.displayName || user?.username}</h2><p className="text-white/80">@{user?.username}</p><p className="text-sm mt-1">{user?.bio || 'No bio yet'}</p></div></div>
    <form onSubmit={saveProfile} className="bg-white dark:bg-gray-700 rounded-2xl p-4 space-y-3 shadow-sm"><h3 className="font-bold dark:text-white flex items-center gap-2"><UserCircle size={18} /> Edit profile</h3><input ref={avatarRef} type="file" accept="image/*" onChange={pickAvatar} className="text-xs dark:text-white" /><input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Username" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white" /><input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="Account name" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white" /><textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Bio" rows="2" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white" /><label className="block text-sm dark:text-white">Who can message me?<select value={form.allowMessagesFrom} onChange={e => setForm({ ...form, allowMessagesFrom: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg dark:bg-gray-800"><option value="everyone">Everyone</option><option value="friends">Friends only</option></select></label><label className="block text-sm dark:text-white">Who can see my posts?<select value={form.allowPostsFrom} onChange={e => setForm({ ...form, allowPostsFrom: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg dark:bg-gray-800"><option value="everyone">Everyone</option><option value="friends">Friends only</option></select></label><label className="block text-sm dark:text-white">Who can see my friend list?<select value={form.showFriends ? 'everyone' : 'no-one'} onChange={e => setForm({ ...form, showFriends: e.target.value === 'everyone' })} className="mt-1 w-full px-3 py-2 border rounded-lg dark:bg-gray-800"><option value="everyone">Everyone</option><option value="no-one">No one</option></select></label><button disabled={savingProfile} className="w-full py-2 rounded-lg bg-sky-500 text-white font-semibold disabled:opacity-60">{savingProfile ? 'Saving...' : 'Save profile'}</button></form>
    <form onSubmit={changePassword} className="bg-white dark:bg-gray-700 rounded-2xl p-4 space-y-3 shadow-sm"><h3 className="font-bold dark:text-white">Change password</h3><input type="password" value={password.currentPassword} onChange={e => setPassword({ ...password, currentPassword: e.target.value })} placeholder="Current password" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white" required /><input type="password" value={password.newPassword} onChange={e => setPassword({ ...password, newPassword: e.target.value })} placeholder="New password" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white" required /><button disabled={changingPassword} className="w-full py-2 rounded-lg bg-indigo-500 text-white disabled:opacity-60">{changingPassword ? 'Changing...' : 'Change password'}</button></form>
    <div className="bg-white dark:bg-gray-700 rounded-2xl p-4 space-y-3 shadow-sm"><h3 className="font-bold dark:text-white">Notification voices</h3><label className="block text-sm dark:text-white">Calling notification voice<input type="file" accept="audio/*" onChange={e => pickSound('call', e)} className="block mt-1 text-xs" /></label><label className="block text-sm dark:text-white">Message notification voice<input type="file" accept="audio/*" onChange={e => pickSound('message', e)} className="block mt-1 text-xs" /></label></div>
    <div><h3 className="font-bold dark:text-white mb-2">My posts</h3>{posts.filter(p => p.authorId === user?.id).map(p => <PostCard key={p.id} post={p} user={user} onRefresh={onRefreshPosts} />)}</div>
  </div>
}

export function PublicProfilePanel({ profile, posts = [], friends = [], friendsHidden = false, user, onBack, onFriends, onMessage, onShare, onShareToChat, onReport, onRefresh }) {
  return <div className="h-full overflow-y-auto overscroll-contain bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
    <div className="mx-auto max-w-4xl space-y-4">
      <button type="button" onClick={onBack} className="rounded-xl border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">← Back</button>
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-gray-800">
        <div className="h-28 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 sm:h-40" />
        <div className="relative px-5 pb-5 sm:px-8">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end">
            <Avatar user={profile} size="h-24 w-24 border-4 border-white text-3xl shadow-lg dark:border-gray-800 sm:h-32 sm:w-32" />
            <div className="min-w-0 flex-1"><h1 className="truncate text-2xl font-bold dark:text-white">{profile.displayName || profile.username}</h1><p className="text-sm text-gray-500">@{profile.username}</p><p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{profile.bio || 'No bio yet'}</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={onMessage} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white">Message</button><button type="button" onClick={onShareToChat} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white">Share in chat</button><button type="button" onClick={onShare} className="rounded-xl border px-4 py-2 text-sm dark:border-gray-600 dark:text-gray-200">Share</button><button type="button" onClick={onReport} className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-500">Report</button></div>
          </div>
          <div className="mt-5 flex gap-6 border-t pt-4 text-sm dark:border-gray-700"><span><strong className="dark:text-white">{posts.length}</strong> <span className="text-gray-500">Posts</span></span><button type="button" onClick={onFriends} className="text-left"><strong className="dark:text-white">{friendsHidden ? '—' : friends.length}</strong> <span className="text-gray-500">Friends</span></button><span className={profile.isOnline ? 'text-green-500' : 'text-gray-500'}>{profile.isOnline ? 'Online' : 'Offline'}</span></div>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section><h2 className="mb-3 text-lg font-bold dark:text-white">Posts</h2>{posts.length ? posts.map(post => <PostCard key={post.id} post={post} user={user} onRefresh={onRefresh} onShareToChat={onShareToChat} onReportPost={onReport} />) : <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 dark:bg-gray-800">No posts yet</div>}</section>
        <aside className="h-fit rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-bold dark:text-white">Friends</h2><button type="button" onClick={onFriends} className="text-xs font-semibold text-sky-500">View all</button></div>{friendsHidden ? <p className="text-sm text-gray-500">Friend list hidden</p> : friends.length ? <div className="space-y-3">{friends.slice(0, 6).map(friend => <div key={friend.id} className="flex items-center gap-3"> <Avatar user={friend} size="h-9 w-9" /><div className="min-w-0"><p className="truncate text-sm font-semibold dark:text-white">{friend.displayName || friend.username}</p><p className="text-xs text-gray-500">@{friend.username}</p></div></div>)}</div> : <p className="text-sm text-gray-500">No friends yet</p>}</aside>
      </div>
    </div>
  </div>
}

export function FriendListScreen({ profile, friends = [], hidden = false, onBack, onOpenProfile }) {
  return <div className="h-full overflow-y-auto overscroll-contain bg-gray-50 p-4 dark:bg-gray-900 sm:p-6"><div className="mx-auto max-w-2xl"><button type="button" onClick={onBack} className="mb-4 rounded-xl border bg-white px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">← Back to profile</button><div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800"><h1 className="text-xl font-bold dark:text-white">{profile.displayName || profile.username}'s Friends</h1>{hidden ? <p className="py-12 text-center text-sm text-gray-500">This friend list is hidden.</p> : friends.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{friends.map(friend => <button type="button" key={friend.id} onClick={() => onOpenProfile(friend)} className="flex items-center gap-3 rounded-xl p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700"><Avatar user={friend} size="h-11 w-11" /><span className="min-w-0"><span className="block truncate font-semibold dark:text-white">{friend.displayName || friend.username}</span><span className="block truncate text-xs text-gray-500">@{friend.username}</span></span></button>)}</div> : <p className="py-12 text-center text-sm text-gray-500">No friends yet</p>}</div></div></div>
}

export function FeedPanel({ user, posts, onRefresh, notificationTarget, onNotificationTargetHandled, onTranslate, onShareToChat, onReportPost }) {
  const [caption, setCaption] = useState(''); const [media, setMedia] = useState([]); const [visibility, setVisibility] = useState('public'); const [allowDownload, setAllowDownload] = useState(true); const [saved, setSaved] = useState(false); const [uploading, setUploading] = useState(false)
  const pickMedia = event => setMedia(previous => [...previous, ...Array.from(event.target.files || [])].slice(0, 10))
  const removeMedia = index => setMedia(previous => previous.filter((_, itemIndex) => itemIndex !== index))
  const submit = async e => { e.preventDefault(); if (!caption.trim() && !media.length) return; setUploading(true); try { const fd = new FormData(); fd.append('caption', caption); fd.append('visibility', visibility); fd.append('allowDownload', String(allowDownload)); media.forEach(file => fd.append('media', file)); await postsAPI.create(fd); setCaption(''); setMedia([]); setVisibility('public'); setAllowDownload(true); e.target.reset(); onRefresh() } catch (err) { alert(err.response?.data?.error || 'Post upload failed') } finally { setUploading(false) } }
  const loadSaved = async () => { const res = await postsAPI.saved(); onRefresh(res.data.posts || []); setSaved(true) }
  return <div className="p-4 space-y-4 overflow-y-auto"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold dark:text-white">Feed</h2><p className="text-xs text-gray-500">Posts from everyone</p></div><button onClick={() => { setSaved(false); onRefresh() }} className="text-sm text-sky-500">All posts</button><button onClick={loadSaved} className="text-sm text-indigo-500">Saved posts</button></div>
    {!saved && <form onSubmit={submit} className="bg-white dark:bg-gray-700 rounded-2xl p-4 shadow-sm space-y-3"><textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="What's on your mind?" rows="2" className="w-full px-3 py-2 border rounded-xl dark:bg-gray-800 dark:text-white" />{media.length > 0 && <div className="grid grid-cols-2 gap-2">{media.map((file, index) => <div key={`${file.name}-${index}`} className="relative rounded-lg bg-gray-100 p-2 text-xs dark:bg-gray-800"><p className="truncate pr-6 dark:text-white">{file.name}</p><p className="text-gray-500">{file.type || 'file'}</p><button type="button" onClick={() => removeMedia(index)} className="absolute right-1 top-1 rounded-full p-1 text-red-500" title="Remove"><X size={14} /></button></div>)}</div>}<div className="flex flex-wrap items-center justify-between gap-2"><label className="text-sm text-sky-600 cursor-pointer flex items-center gap-1"><ImagePlus size={18} /> Add photos/videos/files<input type="file" multiple accept="image/*,video/*,audio/*,application/*,text/*" onChange={pickMedia} className="hidden" /></label><select value={visibility} onChange={e => setVisibility(e.target.value)} className="rounded-lg border px-2 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white" aria-label="Post visibility"><option value="public">Public</option><option value="friends">Friends</option></select><label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" checked={allowDownload} onChange={e => setAllowDownload(e.target.checked)} /> Allow download</label><span className="text-xs text-gray-500">{media.length}/10</span><button disabled={uploading} className="px-4 py-2 rounded-full bg-sky-500 text-white disabled:opacity-60">{uploading ? 'Uploading...' : <Send size={16} />}</button></div></form>}
    {(posts || []).map(post => <PostCard key={post.id} post={post} user={user} notificationTarget={notificationTarget} onNotificationTargetHandled={onNotificationTargetHandled} onRefresh={onRefresh} onTranslate={onTranslate} onShareToChat={onShareToChat} onReportPost={onReportPost} />)}</div>
}

function PostVideo({ src, muted, className }) {
  const videoRef = useRef(null)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined
    const stop = () => video.pause()
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.25) video.play().catch(() => {})
      else stop()
    }, { threshold: [0, 0.25] })
    observer.observe(video)
    return () => { observer.disconnect(); stop() }
  }, [])
  return <video ref={videoRef} src={src} muted={muted} autoPlay loop playsInline preload="metadata" className={className} />
}

function PostCard({ post, user, notificationTarget, onNotificationTargetHandled, onRefresh, onTranslate, onShareToChat, onReportPost }) {
  const [comments, setComments] = useState(post.comments || [])
  const [commentOpen, setCommentOpen] = useState(false)
  const [highlightCommentId, setHighlightCommentId] = useState(null)
  useEffect(() => {
    if (notificationTarget?.postId !== post.id) return
    setHighlightCommentId(notificationTarget.commentId || null)
    if (notificationTarget.commentId) setCommentOpen(true)
    onNotificationTargetHandled?.()
  }, [notificationTarget?.nonce, notificationTarget?.postId, post.id])
  const [replyTo, setReplyTo] = useState(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(post.caption || '')
  const [translatedCaption, setTranslatedCaption] = useState('')
  const [translating, setTranslating] = useState(false)
  const [changing, setChanging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [postLiked, setPostLiked] = useState(Boolean(post.liked))
  const [postLikeCount, setPostLikeCount] = useState(post.likeCount || 0)
  const [shareCount, setShareCount] = useState(post.shareCount || 0)
  const [mediaViewer, setMediaViewer] = useState(null)
  const [postVideoMuted, setPostVideoMuted] = useState(() => localStorage.getItem('caregivers-post-video-muted') !== 'false')
  useEffect(() => {
    const syncSound = event => setPostVideoMuted(event.detail?.muted !== false)
    window.addEventListener('caregivers-post-video-sound', syncSound)
    return () => window.removeEventListener('caregivers-post-video-sound', syncSound)
  }, [])
  const togglePostVideoSound = event => {
    event.stopPropagation()
    const muted = !postVideoMuted
    localStorage.setItem('caregivers-post-video-muted', String(muted))
    window.dispatchEvent(new CustomEvent('caregivers-post-video-sound', { detail: { muted } }))
  }
  useEffect(() => { setComments(post.comments || []); setPostLiked(Boolean(post.liked)); setPostLikeCount(post.likeCount || 0); setShareCount(post.shareCount || 0) }, [post.comments, post.liked, post.likeCount, post.shareCount])
  const countComments = items => (items || []).reduce((total, item) => total + 1 + countComments(item.replies), 0)
  const updateNested = (items, id, updater) => items.map(item => item.id === id ? updater(item) : { ...item, replies: updateNested(item.replies || [], id, updater) })
  const findComment = (items, id) => { for (const item of items) { if (item.id === id) return item; const found = findComment(item.replies || [], id); if (found) return found } return null }
  const toggleLike = async () => { const previousLiked = postLiked; const previousCount = postLikeCount; setPostLiked(!previousLiked); setPostLikeCount(Math.max(0, previousCount + (previousLiked ? -1 : 1))); try { const response = await postsAPI.like(post.id); if (typeof response.data?.liked === 'boolean' && response.data.liked !== !previousLiked) setPostLikeCount(count => Math.max(0, count + (response.data.liked ? 1 : -1))) } catch (err) { setPostLiked(previousLiked); setPostLikeCount(previousCount); alert(err.response?.data?.error || 'Post like failed') } }
  const toggleSave = async () => { setSaving(true); try { await postsAPI.save(post.id); onRefresh() } finally { setSaving(false) } }
  const submitComment = async (content, parentId = null) => { const value = String(content || '').trim(); if (!value) return; const response = await postsAPI.comment(post.id, { content: value, parentId: parentId || undefined }); const created = response.data.comment; setComments(previous => parentId ? updateNested(previous, parentId, item => ({ ...item, replies: [...(item.replies || []), created] })) : [...previous, created]); setReplyTo(null) }
  const editComment = async (id, content) => { const response = await postsAPI.editComment(id, { content }); setComments(previous => updateNested(previous, id, () => response.data.comment)) }
  const deleteComment = async id => { if (!confirm('Delete this comment?')) return; await postsAPI.removeComment(id); setComments(previous => previous.filter(item => item.id !== id).map(item => ({ ...item, replies: (item.replies || []).filter(reply => reply.id !== id) }))) }
  const toggleCommentLike = async id => { const target = findComment(comments, id); if (!target) return; const previousLiked = Boolean(target.liked); setComments(items => updateNested(items, id, item => ({ ...item, liked: !previousLiked, likeCount: Math.max(0, (item.likeCount || 0) + (previousLiked ? -1 : 1)) }))); try { const response = await postsAPI.likeComment(id); if (typeof response.data?.liked === 'boolean' && response.data.liked !== !previousLiked) setComments(items => updateNested(items, id, item => ({ ...item, liked: response.data.liked, likeCount: Math.max(0, (item.likeCount || 0) + (response.data.liked === previousLiked ? (previousLiked ? 1 : -1) : 0)) }))) } catch (err) { setComments(items => updateNested(items, id, item => ({ ...item, liked: previousLiked, likeCount: Math.max(0, (item.likeCount || 0) + (previousLiked ? 1 : -1)) }))); alert(err.response?.data?.error || 'Comment like failed') } }
  const share = async () => { const shareText = (post.author?.displayName || post.author?.username || '') + ': ' + (post.caption || ''); try { if (navigator.share) await navigator.share({ title: 'Caregivers post', text: shareText }); else { await navigator.clipboard?.writeText(shareText); alert('Post link/text copied') }; setShareCount(count => count + 1); await postsAPI.share(post.id) } catch {} }
  const translateCaption = async () => { if (!post.caption || !onTranslate || translating) return; setTranslating(true); try { setTranslatedCaption(await onTranslate(post.caption)) } catch (err) { alert(err.message || 'Translation failed') } finally { setTranslating(false) } }
  const edit = async () => { setChanging(true); try { await postsAPI.edit(post.id, { caption: text }); setEditing(false); onRefresh() } finally { setChanging(false) } }
  const remove = async () => { if (confirm('Delete this post?')) { await postsAPI.remove(post.id); onRefresh() } }
  return <>
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-gray-700"><div className="flex items-center gap-3 p-3"><Avatar user={post.author} /><div className="min-w-0 flex-1"><p className="font-semibold dark:text-white">{post.author?.displayName || post.author?.username}</p><p className="text-xs text-gray-500">@{post.author?.username} · {new Date(post.createdAt).toLocaleString()}</p></div>{post.authorId === user?.id && <div className="flex gap-1"><button onClick={() => setEditing(!editing)} className="p-2 text-gray-500"><Pencil size={16} /></button><button onClick={remove} className="p-2 text-red-500"><Trash2 size={16} /></button></div>}</div>{editing ? <div className="flex gap-2 px-4 pb-3"><input value={text} onChange={e => setText(e.target.value)} className="flex-1 rounded-lg border px-3 py-2 dark:bg-gray-800 dark:text-white" /><button disabled={changing} onClick={edit} className="rounded-lg bg-sky-500 px-3 text-white">Save</button></div> : post.caption && <div className="px-4 pb-3"><p className="whitespace-pre-wrap dark:text-white">{post.caption}</p><button type="button" onClick={translateCaption} disabled={translating} className="mt-1 text-xs text-sky-600 dark:text-sky-300">{translating ? 'ဘာသာပြန်နေသည်…' : 'မြန်မာလိုပြန်ရန်'}</button>{translatedCaption && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-sky-50 p-2 text-sm dark:bg-sky-950/40 dark:text-sky-100">{translatedCaption}</p>}</div>}{(post.mediaItems?.length ? post.mediaItems : (post.mediaUrl ? [{ url: post.mediaUrl, type: post.mediaType || '' }] : [])).length > 0 && <div className="space-y-2">{(post.mediaItems?.length ? post.mediaItems : [{ url: post.mediaUrl, type: post.mediaType || '' }]).map((item, index) => { const itemUrl = item.url || item.mediaUrl; const itemType = String(item.type || '').toLowerCase(); const itemVideo = itemType.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(itemUrl || ''); const itemImage = itemType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(itemUrl || ''); return itemVideo ? <><button key={itemUrl + index} type="button" onClick={() => setMediaViewer({ media: itemUrl, kind: 'video' })} className="post-media block w-full cursor-zoom-in bg-black text-left"><PostVideo src={resolveMediaUrl(itemUrl)} muted={postVideoMuted} className="pointer-events-none w-full object-contain" /></button><button type="button" onClick={togglePostVideoSound} className="mx-auto flex items-center gap-1 rounded-full px-3 py-1 text-xs text-gray-500" title={postVideoMuted ? 'Unmute all Post videos' : 'Mute all Post videos'}>{postVideoMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}{postVideoMuted ? 'အသံပိတ်ထားသည်' : 'အသံဖွင့်ထားသည်'}</button>{item.allowDownload !== false && <a href={resolveMediaUrl(itemUrl)} download={item.name || 'post-video'} className="mx-3 inline-flex items-center gap-1 text-xs text-sky-600 underline"><Download size={13} /> Download video</a>}</> : itemImage ? <><button key={itemUrl + index} type="button" onClick={() => setMediaViewer({ media: itemUrl, kind: 'image' })} className="post-media block w-full cursor-zoom-in text-left"><img src={resolveMediaUrl(itemUrl)} alt={item.name || 'Post'} className="w-full object-contain" /></button>{item.allowDownload !== false && <a href={resolveMediaUrl(itemUrl)} download={item.name || 'post-image'} className="mx-3 inline-flex items-center gap-1 text-xs text-sky-600 underline"><Download size={13} /> Download image</a>}</> : <a key={itemUrl + index} href={resolveMediaUrl(itemUrl)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border p-3 text-sm text-sky-600 dark:border-gray-600"><FileText size={18} /><span className="truncate">{item.name || 'Download file'}</span></a> })}</div>}}<div className="flex flex-wrap items-center gap-4 border-t px-4 py-2 dark:border-gray-600"><button onClick={toggleLike} className={postLiked ? 'flex items-center gap-1 text-sm text-red-500' : 'flex items-center gap-1 text-sm text-gray-500'}><Heart size={18} fill={postLiked ? 'currentColor' : 'none'} /> {postLikeCount}</button><button onClick={() => setCommentOpen(true)} className="flex items-center gap-1 text-sm text-gray-500"><MessageCircle size={18} /> {countComments(comments)}</button><button onClick={share} className="flex items-center gap-1 text-sm text-gray-500"><Share2 size={18} /> {shareCount}</button><button disabled={saving} onClick={toggleSave} className="flex items-center gap-1 text-sm text-gray-500 disabled:opacity-60"><Bookmark size={18} fill={post.saved ? 'currentColor' : 'none'} /> {saving ? 'Saving...' : 'Save'}</button>{onShareToChat && <button onClick={() => onShareToChat(post)} className="text-sm text-sky-600">Post to chat</button>}{onReportPost && <button onClick={() => onReportPost(post)} className="text-sm text-red-500">Report</button>}</div></article>
    {mediaViewer && <MediaViewer media={mediaViewer.media} kind={mediaViewer.kind} onClose={() => setMediaViewer(null)} />}
    {commentOpen && <CommentModal post={post} comments={comments} user={user} highlightCommentId={highlightCommentId} replyTo={replyTo} onReply={setReplyTo} onClose={() => { setCommentOpen(false); setReplyTo(null) }} onSubmit={submitComment} onLike={toggleCommentLike} onDelete={deleteComment} onEdit={editComment} />}
  </>
}
