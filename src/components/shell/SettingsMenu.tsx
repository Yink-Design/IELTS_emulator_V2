import { useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { pausePracticeTimer } from '../../lib/runMode'
import type { ColorTheme, FontSize } from '../../types'

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra Large' },
]

const THEME_OPTIONS: { value: ColorTheme; label: string; swatch: string }[] = [
  { value: 'default', label: 'Black on white', swatch: 'bg-white text-black border-gray-400' },
  { value: 'white-on-black', label: 'White on black', swatch: 'bg-black text-white border-gray-600' },
  { value: 'yellow-on-black', label: 'Yellow on black', swatch: 'bg-black text-yellow-300 border-gray-600' },
]

export default function SettingsMenu({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])

  const exitToList = () => {
    const ok = window.confirm('Return to the test list? Your current progress will be kept so you can resume later.')
    if (!ok) return
    pausePracticeTimer()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    // Do not call exitToHome(): that action intentionally clears the saved session.
    // Switching only the view preserves the autosaved in-progress attempt.
    useStore.setState({ view: 'home' })
    onClose()
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 w-64 z-50 border shadow-lg p-3 text-sm"
      style={{ background: 'var(--ielts-panel)', color: 'var(--ielts-panel-fg)', borderColor: 'var(--ielts-border)' }}
    >
      <div className="font-bold mb-1">Text size</div>
      <div className="flex gap-1 mb-3">
        {FONT_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => updateSettings({ fontSize: o.value })}
            className="flex-1 border px-2 py-1"
            style={{
              borderColor: 'var(--ielts-border)',
              background: settings.fontSize === o.value ? 'var(--ielts-accent)' : 'transparent',
              color: settings.fontSize === o.value ? 'var(--ielts-accent-fg)' : 'inherit',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="font-bold mb-1">Colours</div>
      <div className="flex flex-col gap-1 mb-3">
        {THEME_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => updateSettings({ colorTheme: o.value })}
            className={`flex items-center gap-2 border px-2 py-1 ${o.swatch}`}
            style={{
              outline: settings.colorTheme === o.value ? '2px solid var(--ielts-accent)' : 'none',
              outlineOffset: '-2px',
            }}
          >
            <span className="font-bold">Aa</span>
            <span>{o.label}</span>
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.showTimer}
          onChange={(e) => updateSettings({ showTimer: e.target.checked })}
        />
        Show timer
      </label>

      <div className="border-t mt-3 pt-3" style={{ borderColor: 'var(--ielts-border)' }}>
        <button
          className="w-full border px-3 py-2 text-left font-semibold"
          style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-bg)', color: 'var(--ielts-fg)' }}
          onClick={exitToList}
        >
          Exit to test list
          <span className="block text-xs font-normal opacity-60 mt-0.5">Progress will be saved for Resume.</span>
        </button>
      </div>
    </div>
  )
}
