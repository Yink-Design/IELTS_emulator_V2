import { useRef, useState } from 'react'
import { useStore } from '../store'
import { builtInTests } from '../data'
import {
  downloadTemplate,
  loadImportedTests,
  parseTest,
  saveImportedTests,
} from '../lib/importTest'
import { clearSession, loadSession } from '../lib/session'
import { formatClock } from '../lib/hooks'
import { getPracticeTimerSnapshot, getRunMode, startRunContext, type RunMode } from '../lib/runMode'
import QuestionBankPanel from '../components/bank/QuestionBankPanel'
import type { IeltsTest, ModuleType } from '../types'

const MODULES: { key: ModuleType; label: string }[] = [
  { key: 'listening', label: 'Listening' },
  { key: 'reading', label: 'Reading' },
  { key: 'writing', label: 'Writing' },
]

function moduleCount(test: IeltsTest, module: ModuleType): number | null {
  if (module === 'listening') return test.listening ? test.listening.parts.flatMap((p) => p.groups).flatMap((g) => g.questions).length : null
  if (module === 'reading') return test.reading ? test.reading.passages.flatMap((p) => p.groups).flatMap((g) => g.questions).length : null
  return test.writing ? test.writing.tasks.length : null
}

function TestCard({ test, module, onRemove }: { test: IeltsTest; module: ModuleType; onRemove?: () => void }) {
  const loadAndStart = useStore((s) => s.loadAndStart)
  const count = moduleCount(test, module)

  const start = (mode: RunMode) => {
    startRunContext(test.id, module, mode)
    loadAndStart(test, module)
    if (mode === 'practice') useStore.setState({ endsAt: null })
  }

  return (
    <div className="border p-4" style={{ borderColor: 'var(--ielts-border)' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-lg">{test.title}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide opacity-60">{test.category}</span>
            {test.simplified && (
              <span
                className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 border"
                style={{ borderColor: 'var(--ielts-border)', opacity: 0.7 }}
              >
                Simplified
              </span>
            )}
          </div>
        </div>
        {onRemove && (
          <button className="text-xs underline opacity-60 hover:opacity-100" onClick={onRemove}>
            remove
          </button>
        )}
      </div>

      {test.source && <p className="text-xs opacity-60 mt-1">{test.source}</p>}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={() => start('practice')}
          className="px-3 py-1.5 border text-sm font-semibold"
          style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-accent)', color: 'var(--ielts-accent-fg)' }}
          title="Untimed practice with count-up timers"
        >
          Practice
        </button>
        <button
          onClick={() => start('mock')}
          className="px-3 py-1.5 border text-sm font-semibold"
          style={{ borderColor: 'var(--ielts-border)' }}
          title="Exam-style countdown and automatic submission"
        >
          Mock test
        </button>
        <span className="text-sm opacity-60">
          {count} {module === 'writing' ? 'tasks' : 'questions'}
        </span>
      </div>
      <div className="text-xs opacity-55 mt-2">
        Practice uses positive timers by Part/Passage. Mock test keeps the exam countdown and strict timing.
      </div>
    </div>
  )
}

export default function Home() {
  const [imported, setImported] = useState<IeltsTest[]>(() => loadImportedTests())
  const [bankTests, setBankTests] = useState<IeltsTest[]>([])
  const [paste, setPaste] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [session, setSession] = useState(() => loadSession())
  const [tab, setTab] = useState<ModuleType>('listening')
  const fileRef = useRef<HTMLInputElement>(null)
  const resumeSession = useStore((s) => s.resumeSession)

  const rememberBankTest = (test: IeltsTest) => {
    setBankTests((current) => [...current.filter((t) => t.id !== test.id), test])
  }

  const sessionTest = session
    ? [...builtInTests, ...imported, ...bankTests].find((t) => t.id === session.testId)
    : undefined
  const sessionMode = session ? getRunMode() : 'mock'
  const practiceSnapshot = sessionMode === 'practice' ? getPracticeTimerSnapshot(session?.activeSection ?? 0) : null

  const addTest = (json: string) => {
    try {
      const t = parseTest(json)
      const next = [...imported.filter((x) => x.id !== t.id), t]
      setImported(next)
      saveImportedTests(next)
      setPaste('')
      setError(null)
      setShowImport(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  const removeTest = (id: string) => {
    const next = imported.filter((x) => x.id !== id)
    setImported(next)
    saveImportedTests(next)
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then(addTest)
    e.target.value = ''
  }

  return (
    <div className="flex-1 overflow-auto ielts-scroll">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold">IELTS on Computer — Practice Simulator</h1>
        <p className="opacity-70 mt-1">
          Practice in an IELTS-style computer test environment, or switch to a strict timed mock test.
        </p>

        <div className="border-l-4 p-3 my-5 text-sm" style={{ borderColor: 'var(--ielts-flag)', background: 'var(--ielts-panel)' }}>
          <strong>Test content is separate from the simulator.</strong> The bundled demo is original CC0 material.
          Your own test bank can be loaded from a private GitHub repository, while the simulator remains public on GitHub Pages.
        </div>

        {session && sessionTest && (
          <div
            className="border p-4 my-5 flex items-center justify-between gap-3"
            style={{ borderColor: 'var(--ielts-accent)', background: 'var(--ielts-panel)' }}
          >
            <div>
              <div className="font-bold">Resume saved progress</div>
              <div className="text-sm opacity-70">
                {sessionTest.title} — {session.module} · {sessionMode === 'practice' ? 'Practice' : 'Mock test'}
                {sessionMode === 'practice' && practiceSnapshot
                  ? ` · ${formatClock(practiceSnapshot.totalSec)} elapsed`
                  : session.endsAt != null
                    ? ` · ${formatClock(Math.max(0, Math.round((session.endsAt - Date.now()) / 1000)))} left`
                    : ''}
              </div>
              <div className="text-xs opacity-55 mt-1">
                Answers, Review flags, writing and reading annotations are saved automatically in this browser.
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                className="px-3 py-1.5 text-sm border"
                style={{ borderColor: 'var(--ielts-border)' }}
                onClick={() => {
                  clearSession()
                  setSession(null)
                }}
              >
                Discard
              </button>
              <button
                className="px-3 py-1.5 text-sm font-bold border"
                style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-accent)', color: 'var(--ielts-accent-fg)' }}
                onClick={() => resumeSession(sessionTest, session)}
              >
                Resume
              </button>
            </div>
          </div>
        )}

        {session && !sessionTest && (
          <div className="border p-3 my-5 text-sm" style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-panel)' }}>
            A saved test is waiting to resume. If it came from the private question bank, connect the bank below; the Resume card will appear automatically after that test is loaded.
          </div>
        )}

        <h2 className="font-bold text-lg mt-6 mb-2">Tests</h2>

        <div className="flex border-b mb-3" style={{ borderColor: 'var(--ielts-border)' }}>
          {MODULES.map((m) => {
            const active = tab === m.key
            return (
              <button
                key={m.key}
                onClick={() => setTab(m.key)}
                className="px-4 py-2 text-sm font-semibold -mb-px border-b-2"
                style={{
                  borderColor: active ? 'var(--ielts-accent)' : 'transparent',
                  color: active ? 'var(--ielts-accent)' : 'inherit',
                  opacity: active ? 1 : 0.6,
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>

        {(() => {
          const builtIn = builtInTests.filter((t) => moduleCount(t, tab) != null)
          const userTests = imported.filter((t) => moduleCount(t, tab) != null)
          if (builtIn.length === 0 && userTests.length === 0) return null
          return (
            <div className="grid gap-3">
              {builtIn.map((t) => (
                <TestCard key={t.id} test={t} module={tab} />
              ))}
              {userTests.map((t) => (
                <TestCard key={t.id} test={t} module={tab} onRemove={() => removeTest(t.id)} />
              ))}
            </div>
          )
        })()}

        <QuestionBankPanel module={tab} onLoadedTest={rememberBankTest} />

        <div className="mt-6">
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 border text-sm font-semibold"
              style={{ borderColor: 'var(--ielts-border)' }}
              onClick={() => setShowImport((v) => !v)}
            >
              {showImport ? 'Close importer' : '+ Import a local test (JSON)'}
            </button>
            <button
              className="px-3 py-1.5 border text-sm"
              style={{ borderColor: 'var(--ielts-border)' }}
              onClick={downloadTemplate}
            >
              Download JSON template
            </button>
          </div>

          {showImport && (
            <div className="border p-4 mt-3" style={{ borderColor: 'var(--ielts-border)' }}>
              <label className="block text-sm font-semibold mb-1">Upload a .json file</label>
              <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="text-sm" />

              <div className="text-sm font-semibold mt-4 mb-1">…or paste JSON</div>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                spellCheck={false}
                className="w-full h-40 border p-2 font-mono text-xs"
                style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-bg)', color: 'var(--ielts-fg)' }}
                placeholder='{ "id": "...", "title": "...", "reading": { ... } }'
              />
              <div className="flex gap-2 mt-2">
                <button
                  className="px-3 py-1.5 border text-sm font-semibold"
                  style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-accent)', color: 'var(--ielts-accent-fg)' }}
                  onClick={() => addTest(paste)}
                >
                  Import
                </button>
              </div>
              {error && <p className="text-rose-500 text-sm mt-2">{error}</p>}
            </div>
          )}
        </div>

        <p className="text-xs opacity-50 mt-8">
          Speaking is a face-to-face / video interview in the real exam and is not part of the
          computer-delivered session, so it is not simulated here.
        </p>
      </div>
    </div>
  )
}
