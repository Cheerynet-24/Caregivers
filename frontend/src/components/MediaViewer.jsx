import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { resolveMediaUrl } from '../services/api'

export default function MediaViewer({ media, kind, onClose }) {
  const [zoomed, setZoomed] = useState(false)
  const closing = useRef(false)
  const url = resolveMediaUrl(media)
  useEffect(() => {
    const previous = window.CaregiversHandleBack
    window.CaregiversHandleBack = () => { if (!closing.current) { closing.current = true; onClose() } return true }
    return () => { window.CaregiversHandleBack = previous }
  }, [onClose])
  const close = () => { if (!closing.current) { closing.current = true; onClose() } }
  return <div className="fixed inset-0 z-[130] flex h-[100dvh] w-full flex-col overflow-hidden bg-black/95" role="dialog" aria-modal="true">
    <header className="flex shrink-0 items-center justify-between px-3 py-2 text-white">
      <span className="text-xs opacity-70">{kind === 'video' ? 'Video' : 'Photo'}</span>
      <div className="flex items-center gap-2">
        {kind === 'image' && <button type="button" onClick={() => setZoomed(value => !value)} className="rounded-full bg-white/15 p-2" title={zoomed ? 'Original size' : 'Zoom'}>{zoomed ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>}
        <button type="button" onClick={close} className="rounded-full bg-white/15 p-2" title="Close"><X size={21} /></button>
      </div>
    </header>
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-2" onClick={event => event.target === event.currentTarget && close()}>
      {kind === 'video' ? <video src={url} controls playsInline autoPlay className="max-h-full max-w-full object-contain" /> : <img src={url} alt="Full screen" className={`max-h-full max-w-full object-contain transition-transform duration-200 ${zoomed ? 'scale-[1.8]' : 'scale-100'}`} />}
    </main>
  </div>
}
