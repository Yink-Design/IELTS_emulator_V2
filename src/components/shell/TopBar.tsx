import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { formatClock, useRemainingSeconds } from '../../lib/hooks'
import {
  getRunMode,
  pausePracticeTimer,
  resumePracticeTimer,
  tickPracticeTimer,
  type PracticeTimerSnapshot,
} from '../../lib/runMode'
import SettingsMenu from './SettingsMenu'

const MODULE_LABEL: Record<string, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
}

export default function TopBar({
  notesOpen = false,
  onToggleNotes,
}: {
  notesOpen?: boolean
  onToggleNotes?: () => void
}) {
  const test = useStore((s) => s.test)
  const module = useStore((s) => s.module)
  const activeSection = useStore((s) => s.activeSection)
  const endsAt = useStore((s) => s.endsAt)
  const submit = useStore((s) => s.submit)
  const submitted = useStore((s) => s.submitted)
  const showTimer = useStore((s) => s.settings.showTimer)
  const updateSettings = useStore((s) => s.updateSettings)
  const volume = useStore((s) => s.volume)
  const setVolume = useStore((s) => s.setVolume)

  const [menuOpen, setMenuOpen] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [runMode] = useState(getRunMode)
  const [practiceTimes, setPracticeTimes] = useState<PracticeTimerSnapshot>({ totalSec: 0, sectionSec: 0 })
  const prevRef = useRef<number>(Infinity)
  const sectionRef = useRef(activeSection)
  sectionRef.current = activeSection

  const onExpire = useCallback(() => {
    if (!useStore.getState().submitted) submit()
  }, [submit])

  const remaining = useRemainingSeconds(endsAt, onExpire)

  useEffect(() => {
    if (runMode !== 'practice' || !test || !module || submitted) return

    setPracticeTimes(resumePracticeTimer(test.id, module, sectionRef.current))
    const tick = () => {
      setPracticeTimes(tickPracticeTimer(test.id, module, sectionRef.current))
    }
    const id = window.setInterval(tick, 500)
    const onPageHide = () => pausePracticeTimer()
    window.addEventListener('pagehide', onPageHide)

    return () => {
      window.clearInterval(id)
      window.removeEventListener('pagehide', onPageHide)
      pausePracticeTimer()
    }
  }, [runMode, test, module, submitted])

  useEffect(() => {
    if (runMode !== 'mock') return
    const prev = prevRef.current
    for (const mins of [10, 5, 1]) {
      const t = mins * 60
      if (prev > t && remaining <= t && remaining > 0) {
        setWarning(`You have ${mins} minute${mins > 1 ? 's' : ''} left.`)
        const id = setTimeout(() => setWarning(null), 6000)
        prevRef.current = remaining
        return () => clearTimeout(id)
      }
    }
    prevRef.current = remaining
  }, [remaining, runMode])

  const low = runMode === 'mock' && remaining <= 300
  const sectionLabel = module === 'reading'
    ? `Passage ${activeSection + 1}`
    : module === 'listening'
      ? `Part ${activeSection + 1}`
      : `Task ${activeSection + 1}`

  return (
    <header className="exam-topbar shrink-0 flex items-center justify-between select-none">
      <div className="exam-candidate flex items-center min-w-0">
        <span className="exam-brand font-bold whitespace-nowrap">IELTS on Computer</span>
        <span className="exam-candidate-meta whitespace-nowrap hidden sm:inline">
          Candidate 000001
        </span>
        <span className="exam-module whitespace-nowrap hidden md:inline">
          {module ? MODULE_LABEL[module] : ''}
        </span>
        <span className="exam-candidate-meta whitespace-nowrap hidden lg:inline">
          {runMode === 'practice' ? 'Practice' : 'Mock'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {module === 'listening' && (
          <div className="exam-volume flex items-center gap-2" title="Volume">
            <span aria-hidden>🔊</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
            />
          </div>
        )}

        {!submitted && (
          <div className="exam-timer-group flex items-center">
            {runMode === 'practice' ? (
              <span className="exam-timer tabular-nums" aria-live="polite" title="Practice time">
                {showTimer ? `${sectionLabel} ${formatClock(practiceTimes.sectionSec)} · Total ${formatClock(practiceTimes.totalSec)}` : 'Time hidden'}
              </span>
            ) : (
              <span
                className="exam-timer tabular-nums"
                data-low={low}
                aria-live="polite"
              >
                {showTimer ? formatClock(remaining) : 'Time hidden'}
              </span>
            )}
            <button
              onClick={() => updateSettings({ showTimer: !showTimer })}
              className="exam-tool-btn"
            >
              {showTimer ? 'Hide' : 'Show'}
            </button>
          </div>
        )}

        {module === 'reading' && onToggleNotes && (
          <button onClick={onToggleNotes} className="exam-tool-btn" aria-pressed={notesOpen}>
            {notesOpen ? 'Close notes' : 'Notes'}
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="exam-tool-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            Settings
          </button>
          {menuOpen && <SettingsMenu onClose={() => setMenuOpen(false)} />}
        </div>
      </div>

      {warning && (
        <div className="exam-time-warning" role="alert">
          {warning}
        </div>
      )}
    </header>
  )
}
