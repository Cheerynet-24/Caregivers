import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { resolveMediaUrl } from '../services/api'

export default function MediaViewer({ media, kind, onClose }) {
  const [zoomed, setZoomed] = useState(false)
  const pushed = useRef(false)
  const closing = useRef(false)
  const originalState = useRef(null)
  const url = resolveMediaUrl(media)

  useEffect(() => {
    originalState.current = window.history.state
    window.history.pushState({ ...window.history.state, caregiversMediaViewer: true }, '', window.location.href)
    pushed.current = true
    const handleBack = () => {
      if (closing.current) return
      // Android WebView can otherwise leave the SPA when this is the first
      // navigation entry. Restore the current entry before unmounting.
      window.history.pushState({ ...window.history.state, caregiversMediaViewer: true }, '', window.location.href)
      closing.current = true
      onClose()
    }
    const handleNativeBack = event => {
      event?.preventDefault?.()
      if (closing.current) return
      closing.current = true
      onClose()
    }
    const handleKey = event => { if (event.key === 'Escape') closeViewer() }
    window.addEventListener('popstate', handleBack)
    document.addEventListener('backbutton', handleNativeBack)
    window.addEventListener('hardwareBackPress', handleNativeBack)
    window.addEventListener('keydown', handleKey)
    return () => { window.removeEventListener('popstate', handleBack); document.removeEventListener('backbutton', handleNativeBack); window.removeEventListener('hardwareBackPress', handleNativeBack); window.removeEventListener('keydown', handleKey) }
  }, [])

  const closeViewer = () => {
    if (closing.current) return
    closing.current = true
    if (pushed.current) window.history.replaceState(originalState.current, '', window.location.href)
    onClose()
  }
  const toggleZoom = () => setZoomed(value => !value)

  return <div className="fixed inset-0 z-[130] flex flex-col bg-black/95" role="dialog" aria-modal="true">
    <header className="flex shrink-0 items-center justify-between px-3 py-2 text-white">
      <span className="text-xs opacity-70">{kind === 'video' ? (zoomed ? 'ချဲ့ထားသော Video' : 'Video') : 'Photo'}</span>
      <div className="flex items-center gap-2">
        {kind === 'video' && <button type="button" onClick={toggleZoom} className="rounded-full bg-white/15 p-2" title={zoomed ? 'Original size' : 'Full screen size'}>{zoomed ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>}
        <button type="button" onClick={closeViewer} className="rounded-full bg-white/15 p-2" title="Back"><X size={21} /></button>
      </div>
    </header>
    <main className="min-h-0 flex-1 overflow-auto p-2" onClick={event => { if (event.target === event.currentTarget) closeViewer() }}>
      <div className={`flex min-h-full w-full items-center justify-center ${zoomed ? 'min-w-[115vw] min-h-[115vh]' : ''}`}>
        {kind === 'video' ? <video src={url} controls autoPlay playsInline className={zoomed ? 'max-h-none w-[115vw] max-w-none object-contain' : 'max-h-full max-w-full object-contain'} /> : <img src={url} alt="Full screen" className="max-h-full max-w-full object-contain" />}
      </div>
    </main>
  </div>
}
