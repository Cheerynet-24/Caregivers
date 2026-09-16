import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, X, Heart, Reply, Trash2, Pencil, BarChart3 } from 'lucide-react'
import { resolveMediaUrl } from '../services/api'

const isSticker = value => typeof value === 'string' && value.startsWith('sticker:')
const stickerUrl = value => value.slice('sticker:'.length)
const isPoll = value => typeof value === 'string' && value.startsWith('poll:')
const pollData = value => { try { return JSON.parse(value.slice('poll:'.length)) } catch { return null } }
const countComments = items => (items || []).reduce((total, item) => total + 1 + countComments(item.replies), 0)

function PollComment({ content }) {
  const [selected, setSelected] = useState(null)
  const poll = pollData(content)
  if (!poll?.question || !poll.options?.length) return <span>Poll unavailable</span>
  return <div className="w-full max-w-sm"><p className="font-semibold">{poll.question}</p><div className="mt-2 space-y-1">{poll.options.map((option, index) => <button type="button" key={option} onClick={() => setSelected(current => current === index ? null : index)} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs ${selected === index ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200' : 'border-gray-200 dark:border-gray-600'}`}><span>{option}</span>{selected === index && <span>✓</span>}</button>)}</div></div>
}

function CommentContent({ content }) {
  return isPoll(content) ? <PollComment content={content} /> : isSticker(content)
    ? <img src={resolveMediaUrl(stickerUrl(content))} alt="Sticker" className="max-h-28 max-w-28 rounded-xl object-contain" />
    : <span className="whitespace-pre-wrap break-words">{content}</span>
}

function CommentItem({ comment, user, depth = 0, onReply, onLike, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content || '')
  const name = comment.author?.displayName || comment.author?.username || 'User'
  const canEdit = comment.authorId === user?.id && !isSticker(comment.content)
  return <div className={`${depth ? 'ml-5 border-l border-sky-100 pl-3 dark:border-gray-600' : ''} py-2`}>
    <div className="flex items-start gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-900 dark:text-sky-200">{name[0]?.toUpperCase() || '?'}</div>
      <div className="min-w-0 flex-1 rounded-2xl bg-gray-100 px-3 py-2 dark:bg-gray-700">
        <p className="text-xs font-semibold text-sky-600 dark:text-sky-300">{name}</p>
        {editing ? <div className="mt-1 flex gap-2"><input autoFocus value={draft} onChange={event => setDraft(event.target.value)} className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" /><button type="button" onClick={() => { onEdit(comment.id, draft); setEditing(false) }} className="text-xs text-sky-500">Save</button></div> : <div className="mt-1 text-sm dark:text-white"><CommentContent content={comment.content} /></div>}
      </div>
    </div>
    <div className="ml-10 mt-1 flex items-center gap-3 text-xs text-gray-500">
      <button type="button" onClick={() => onLike(comment.id)} className={comment.liked ? 'text-red-500' : ''}><Heart size={13} className="mr-1 inline" fill={comment.liked ? 'currentColor' : 'none'} />{comment.likeCount || 0}</button>
      {depth < 3 && <button type="button" onClick={() => onReply(comment)}><Reply size={13} className="mr-1 inline" />Reply</button>}
      {canEdit && <button type="button" onClick={() => setEditing(true)}><Pencil size={13} className="mr-1 inline" />Edit</button>}
      {comment.authorId === user?.id && <button type="button" onClick={() => onDelete(comment.id)} className="text-red-500"><Trash2 size={13} className="mr-1 inline" />Delete</button>}
    </div>
    {(comment.replies || []).map(reply => <CommentItem key={reply.id} comment={reply} user={user} depth={depth + 1} onReply={onReply} onLike={onLike} onDelete={onDelete} onEdit={onEdit} />)}
  </div>
}

export default function CommentModal({ post, comments, user, replyTo, onReply, onClose, onSubmit, onLike, onDelete, onEdit }) {
  const [draft, setDraft] = useState('')
  const [stickers, setStickers] = useState([])
  const [showStickers, setShowStickers] = useState(false)
  const closingFromBack = useRef(false)
  const originalHistoryState = useRef(null)
  const previousBackHandler = useRef(null)
  const total = useMemo(() => countComments(comments), [comments])

  useEffect(() => {
    try { setStickers(JSON.parse(localStorage.getItem('caregivers-my-stickers') || '[]')) } catch { setStickers([]) }
  }, [])
  useEffect(() => {
    originalHistoryState.current = window.history.state
    window.history.pushState({ ...window.history.state, caregiversCommentModal: true }, '', window.location.href)
    const handleOverlayBack = () => {
      if (closingFromBack.current) return true
      closingFromBack.current = true
      window.history.replaceState(originalHistoryState.current, '', window.location.href)
      onClose()
      return true
    }
    previousBackHandler.current = window.CaregiversHandleBack
    window.CaregiversHandleBack = handleOverlayBack
    const handleBack = () => {
      // Immediately restore an in-app history entry. This prevents Android WebView/PWA
      // from interpreting the Back action as an app exit.
      window.history.pushState({ ...window.history.state, caregiversCommentModal: true }, '', window.location.href)
      handleOverlayBack()
    }
    const handleNativeBack = event => {
      event?.preventDefault?.()
      handleOverlayBack()
    }
    window.addEventListener('popstate', handleBack)
    document.addEventListener('backbutton', handleNativeBack)
    window.addEventListener('hardwareBackPress', handleNativeBack)
    return () => { window.removeEventListener('popstate', handleBack); document.removeEventListener('backbutton', handleNativeBack); window.removeEventListener('hardwareBackPress', handleNativeBack); if (window.CaregiversHandleBack === handleOverlayBack) window.CaregiversHandleBack = previousBackHandler.current }
  }, [])
  const closeModal = () => {
    if (closingFromBack.current) return
    closingFromBack.current = true
    window.history.replaceState(originalHistoryState.current, '', window.location.href)
    onClose()
  }
  const submit = (content, parentId = replyTo?.id || null) => {
    const value = content ?? draft.trim()
    if (!value) return
    onSubmit(value, parentId)
    setDraft('')
    setShowStickers(false)
  }
  const createPoll = () => {
    const question = window.prompt('မဲခွဲမေးခွန်း ရေးပါ')?.trim()
    if (!question) return
    const options = window.prompt('ရွေးချယ်စရာများကို comma ဖြင့်ခွဲရေးပါ')?.split(',').map(item => item.trim()).filter(Boolean).slice(0, 6) || []
    if (options.length < 2) return alert('ရွေးချယ်စရာ အနည်းဆုံး ၂ ခုလိုပါတယ်')
    submit(`poll:${JSON.stringify({ question, options })}`)
  }
  return <div className="fixed inset-0 z-[100] flex flex-col bg-gray-50 dark:bg-gray-900">
    <header className="flex shrink-0 items-center gap-3 border-b bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <button type="button" onClick={closeModal} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={21} /></button>
      <div className="min-w-0 flex-1"><h2 className="truncate font-bold dark:text-white">Comments</h2><p className="truncate text-xs text-gray-500">{post.caption || 'Post'} · {total} comments</p></div>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:mx-auto sm:w-full sm:max-w-2xl"><div className="mb-3 rounded-2xl bg-white p-3 shadow-sm dark:bg-gray-800"><p className="line-clamp-3 text-sm dark:text-gray-200">{post.caption || 'Post comments'}</p></div>{comments.length ? comments.map(comment => <CommentItem key={comment.id} comment={comment} user={user} onReply={onReply} onLike={onLike} onDelete={onDelete} onEdit={onEdit} />) : <p className="py-16 text-center text-sm text-gray-400">No comments yet</p>}</main>
    {showStickers && <div className="max-h-48 shrink-0 overflow-y-auto border-t bg-white p-3 dark:border-gray-700 dark:bg-gray-800"><div className="grid grid-cols-6 gap-2">{stickers.filter(item => item.fileUrl || item.content).map((sticker, index) => <button type="button" key={`${sticker.fileUrl}-${sticker.content}-${index}`} onClick={() => submit(`sticker:${sticker.fileUrl}`, replyTo?.id || null)} className="flex h-12 items-center justify-center rounded-lg bg-gray-100 p-1 dark:bg-gray-700">{sticker.fileUrl ? <img src={resolveMediaUrl(sticker.fileUrl)} alt="" className="h-full w-full object-contain" /> : <span>{sticker.content}</span>}</button>)}</div></div>}
    <form onSubmit={event => { event.preventDefault(); submit() }} className="shrink-0 border-t bg-white p-3 dark:border-gray-700 dark:bg-gray-800"><div className="mx-auto flex max-w-2xl items-end gap-2">{replyTo && <button type="button" onClick={() => onReply(null)} className="absolute -mt-12 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:bg-sky-900/50 dark:text-sky-200">Replying to {replyTo.author?.displayName || replyTo.author?.username || 'comment'} · cancel</button>}<button type="button" onClick={() => setShowStickers(value => !value)} className={`rounded-full p-2 text-xl ${showStickers ? 'text-sky-500' : 'text-gray-500'}`} title="Sticker">☺</button><button type="button" onClick={createPoll} className="rounded-full p-2 text-gray-500" title="Create poll"><BarChart3 size={19} /></button><textarea value={draft} onChange={event => setDraft(event.target.value)} rows="1" placeholder="Write a comment…" className="min-w-0 flex-1 resize-none rounded-2xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /><button type="submit" disabled={!draft.trim()} className="rounded-full bg-sky-500 p-3 text-white disabled:opacity-40"><Send size={17} /></button></div></form>
  </div>
}

export { countComments, isSticker }
