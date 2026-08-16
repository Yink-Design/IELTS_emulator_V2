import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { asset } from '../../lib/asset'
import { buildPlayScript, VOICE_MAP } from '../../lib/listeningScript'
import { getListeningProgress, saveListeningProgress } from '../../lib/runMode'
import type { ListeningPart } from '../../types'

type Mode = 'audio' | 'tts' | 'none'

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return (
    voices.find((v) => v.lang === 'en-GB') ??
    voices.find((v) => v.lang?.startsWith('en')) ??
    null
  )
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis
  const ready = synth.getVoices()
  if (ready.length) return Promise.resolve(ready)
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve(synth.getVoices())
    }
    synth.addEventListener?.('voiceschanged', finish, { once: true })
    setTimeout(finish, 1500)
  })
}

/**
 * Listening audio that mimics the exam: it plays once automatically and cannot
 * be paused or rewound. For real audio files, the current playback position is
 * saved locally so an accidental close/reload can resume from the same point.
 */
export default function AudioPlayer({ part, onEnded }: { part: ListeningPart; onEnded: () => void }) {
  const volume = useStore((s) => s.volume)
  const testId = useStore((s) => s.test?.id ?? '')
  const audioRef = useRef<HTMLAudioElement>(null)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
  const ttsActive = useRef(false)
  const startedRef = useRef(false)
  const audioStartedRef = useRef(false)

  const hasTTS = !!part.transcript && 'speechSynthesis' in window
  const initialMode: Mode = part.audio ? 'audio' : hasTTS ? 'tts' : 'none'
  const resumeAt = testId ? getListeningProgress(testId, part.number) : 0

  const [mode, setMode] = useState<Mode>(initialMode)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [needsGesture, setNeedsGesture] = useState(false)

  const finish = () => {
    const a = audioRef.current
    if (testId && a?.duration) saveListeningProgress(testId, part.number, a.duration)
    setProgress(1)
    setPlaying(false)
    onEndedRef.current()
  }

  const startTTS = () => {
    if (!part.transcript) return
    const synth = window.speechSynthesis
    synth.cancel()

    const segments = buildPlayScript(part)
    type Item = { kind: 'speech'; text: string; pitch: number } | { kind: 'pause'; ms: number }
    const queue: Item[] = []
    for (const seg of segments) {
      if (seg.kind === 'pause') {
        queue.push({ kind: 'pause', ms: (seg.seconds ?? 0) * 1000 })
      } else {
        const pitch = VOICE_MAP[seg.voice ?? 'narrator']?.pitch ?? 1
        const sentences = (seg.text ?? '').match(/[^.!?]+[.!?]*\s*/g) ?? [seg.text ?? '']
        for (const s of sentences) if (s.trim()) queue.push({ kind: 'speech', text: s, pitch })
      }
    }
    const total = Math.max(1, queue.length)
    let i = 0
    ttsActive.current = true
    startedRef.current = false

    setMode('tts')
    setNeedsGesture(false)
    setPlaying(true)

    loadVoices().then((voices) => {
      if (!ttsActive.current) return
      const voice = pickVoice(voices)

      const next = () => {
        if (!ttsActive.current) return
        if (i >= queue.length) {
          finish()
          return
        }
        const item = queue[i]
        setProgress(Math.min(0.99, i / total))
        if (item.kind === 'pause') {
          i++
          setTimeout(next, item.ms)
          return
        }
        const u = new SpeechSynthesisUtterance(item.text)
        u.volume = volume
        u.rate = 0.95
        u.pitch = item.pitch
        u.lang = 'en-GB'
        if (voice) u.voice = voice
        u.onstart = () => {
          startedRef.current = true
          setNeedsGesture(false)
        }
        u.onend = () => {
          i++
          setTimeout(next, 250)
        }
        u.onerror = () => {
          i++
          setTimeout(next, 0)
        }
        synth.speak(u)
      }

      next()
    })
  }

  const startAudio = () => {
    const a = audioRef.current
    if (!a || audioStartedRef.current) return

    if (Number.isFinite(a.duration) && a.duration > 0) {
      if (resumeAt >= a.duration - 0.25) {
        a.currentTime = a.duration
        setProgress(1)
        setPlaying(false)
        audioStartedRef.current = true
        return
      }
      if (resumeAt > 0) a.currentTime = Math.min(resumeAt, Math.max(0, a.duration - 0.25))
    }

    a.volume = volume
    audioStartedRef.current = true
    a.play()
      .then(() => {
        setNeedsGesture(false)
        setPlaying(true)
      })
      .catch(() => {
        audioStartedRef.current = false
        setNeedsGesture(true)
      })
  }

  const fallback = () => {
    if (hasTTS) startTTS()
    else setMode('none')
  }

  useEffect(() => {
    setProgress(0)
    audioStartedRef.current = false
    if (initialMode === 'tts') {
      startTTS()
      const t = setTimeout(() => {
        if (!startedRef.current) setNeedsGesture(true)
      }, 2500)
      return () => {
        clearTimeout(t)
        ttsActive.current = false
        window.speechSynthesis.cancel()
      }
    }
    if (initialMode === 'none') setMode('none')
    return () => {
      ttsActive.current = false
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const pct = Math.round(progress * 100)
  const unavailable = mode === 'none'

  return (
    <div className="border p-3 mb-4" style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-panel)' }}>
      <div className="flex items-center gap-3">
        <span className="text-xl" aria-hidden>
          {playing ? '🔊' : unavailable ? '🔇' : '⏸'}
        </span>
        <div className="flex-1">
          <div className="font-bold text-sm">
            Part {part.number} audio{mode === 'tts' && part.audio ? ' (read aloud)' : ''}
          </div>
          <div className="text-xs opacity-70">
            {unavailable ? 'No audio for this part.' : 'The recording plays once. You cannot pause or replay it.'}
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden" style={{ background: 'var(--ielts-border)' }}>
            <div
              className={`h-full ${playing && pct === 0 ? 'animate-pulse' : ''}`}
              style={{ width: `${Math.max(pct, playing ? 4 : 0)}%`, background: 'var(--ielts-accent)', transition: 'width .3s' }}
            />
          </div>
        </div>
      </div>

      {needsGesture && (
        <button
          onClick={mode === 'audio' ? startAudio : startTTS}
          className="mt-3 px-4 py-1.5 font-bold border"
          style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-accent)', color: 'var(--ielts-accent-fg)' }}
        >
          ▶ Play audio
        </button>
      )}

      {part.audio && mode === 'audio' && (
        <audio
          ref={audioRef}
          src={asset(part.audio)}
          onLoadedMetadata={(e) => {
            const a = e.currentTarget
            if (a.duration && resumeAt > 0) {
              if (resumeAt >= a.duration - 0.25) {
                a.currentTime = a.duration
                setProgress(1)
                audioStartedRef.current = true
                return
              }
              a.currentTime = Math.min(resumeAt, Math.max(0, a.duration - 0.25))
              setProgress(a.currentTime / a.duration)
            }
            startAudio()
          }}
          onTimeUpdate={(e) => {
            const a = e.currentTarget
            if (a.duration) setProgress(a.currentTime / a.duration)
            if (testId) saveListeningProgress(testId, part.number, a.currentTime)
          }}
          onEnded={finish}
          onError={fallback}
          preload="auto"
        />
      )}
    </div>
  )
}
