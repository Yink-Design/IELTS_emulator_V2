import { useRef, useState } from 'react'
import { useStore } from '../store'
import { builtInTests } from '../data'
import {
  downloadTemplate,
  getImportMeta,
  loadImportedTests,
  parseTest,
  saveImportedTests,
} from '../lib/importTest'
import {
  clearGithubConnection,
  importFromGithubRepository,
  loadGithubConnection,
  saveGithubConnection,
  type GithubConnectionRecord,
} from '../lib/githubImport'
import { clearSession, loadSession } from '../lib/session'
import { formatClock } from '../lib/hooks'
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

function Badge({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 border"
      style={{
        borderColor: strong ? 'var(--ielts-accent)' : 'var(--ielts-border)',
        color: strong ? 'var(--ielts-accent)' : 'inherit',
        opacity: strong ? 1 : 0.72,
      }}
    >
      {children}
    </span>
  )
}

function TestCard({ test, module, onRemove }: { test: IeltsTest; module: ModuleType; onRemove?: () => void }) {
  const loadAndStart = useStore((s) => s.loadAndStart)
  const count = moduleCount(test, module)
  const importMeta = getImportMeta(test)

  return (
    <div className="border p-4" style={{ borderColor: 'var(--ielts-border)' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-lg">{test.title}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs uppercase tracking-wide opacity-60">{test.category}</span>
            {importMeta && <Badge strong>External</Badge>}
            {importMeta?.cambridgeBook != null && <Badge strong>剑{importMeta.cambridgeBook}</Badge>}
            {importMeta?.cambridgeTest != null && <Badge>Test {importMeta.cambridgeTest}</Badge>}
            {test.simplified && <Badge>Simplified</Badge>}
          </div>
        </div>
        {onRemove && (
          <button className="text-xs underline opacity-60 hover:opacity-100" onClick={onRemove}>
            remove
          </button>
        )}
      </div>

      {test.source && <p className="text-xs opacity-60 mt-1">{test.source}</p>}
      {importMeta?.provider === 'github' && importMeta.repository && (
        <p className="text-xs opacity-50 mt-1">Imported from {importMeta.repository}</p>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => loadAndStart(test, module)}
          className="px-3 py-1.5 border text-sm font-semibold"
          style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-accent)', color: 'var(--ielts-accent-fg)' }}
        >
          Start {MODULES.find((m) => m.key === module)?.label}
        </button>
        {module !== 'writing' && <span className="text-sm opacity-60">{count} questions</span>}
        {module === 'writing' && <span className="text-sm opacity-60">{count} tasks</span>}
      </div>
    </div>
  )
}

export default function Home() {
  const [imported, setImported] = useState<IeltsTest[]>(() => loadImportedTests())
  const [paste, setPaste] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [session, setSession] = useState(() => loadSession())
  const [tab, setTab] = useState<ModuleType>('listening')
  const [connection, setConnection] = useState<GithubConnectionRecord | null>(() => loadGithubConnection())
  const [githubRepo, setGithubRepo] = useState(() => connection?.repository ?? 'Yink-Design/IELTS_database')
  const [githubBranch, setGithubBranch] = useState(() => connection?.branch ?? 'master')
  const [githubToken, setGithubToken] = useState('')
  const [githubBusy, setGithubBusy] = useState(false)
  const [githubMessage, setGithubMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const resumeSession = useStore((s) => s.resumeSession)

  const sessionTest = session
    ? [...builtInTests, ...imported].find((t) => t.id === session.testId)
    : undefined

  const mergeImported = (tests: IeltsTest[]) => {
    const ids = new Set(tests.map((test) => test.id))
    const next = [...imported.filter((test) => !ids.has(test.id)), ...tests]
    setImported(next)
    saveImportedTests(next)
    return next
  }

  const addTest = (json: string, path?: string) => {
    try {
      const test = parseTest(json, { provider: 'file', path })
      mergeImported([test])
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
    file.text().then((text) => addTest(text, file.name))
    e.target.value = ''
  }

  const onGithubImport = async () => {
    if (githubBusy) return
    setGithubBusy(true)
    setError(null)
    setGithubMessage(null)
    try {
      const result = await importFromGithubRepository(githubRepo, githubBranch, githubToken)
      if (result.tests.length > 0) mergeImported(result.tests)

      const record: GithubConnectionRecord = {
        repository: githubRepo.trim(),
        branch: githubBranch.trim() || 'master',
        lastSyncAt: new Date().toISOString(),
        recognizedTests: result.recognized,
        importedTests: result.tests.length,
      }
      saveGithubConnection(record)
      setConnection(record)

      const missingText = result.missing.length > 0
        ? ` ${result.missing.length} catalog entries are recognized but do not have emulator-ready JSON yet.`
        : ''
      setGithubMessage(`Recognized ${result.recognized} tests and imported ${result.tests.length}.${missingText} Token cleared.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GitHub import failed.')
    } finally {
      setGithubToken('')
      setGithubBusy(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto ielts-scroll">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold">IELTS on Computer — Practice Simulator</h1>
        <p className="opacity-70 mt-1">
          A faithful re-creation of the computer-delivered IELTS test environment: timed Listening,
          Reading and Writing modules, the same navigation, highlighter, settings and review tools.
        </p>

        <div className="border-l-4 p-3 my-5 text-sm" style={{ borderColor: 'var(--ielts-flag)', background: 'var(--ielts-panel)' }}>
          <strong>About the content.</strong> The bundled test is original material written for this
          app (CC0). External tests can be imported from JSON or from a private GitHub repository.
          GitHub access tokens are used only for the current import attempt and are not saved by the app.
        </div>

        {session && sessionTest && (
          <div
            className="border p-4 my-5 flex items-center justify-between gap-3"
            style={{ borderColor: 'var(--ielts-accent)', background: 'var(--ielts-panel)' }}
          >
            <div>
              <div className="font-bold">Resume your test in progress</div>
              <div className="text-sm opacity-70">
                {sessionTest.title} — {session.module}
                {session.endsAt != null &&
                  ` · ${formatClock(Math.max(0, Math.round((session.endsAt - Date.now()) / 1000)))} left`}
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
          if (builtIn.length === 0 && userTests.length === 0) {
            return (
              <p className="text-sm opacity-60">
                No tests include a {MODULES.find((m) => m.key === tab)?.label} module yet. Import one below.
              </p>
            )
          }
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

        <div className="mt-6">
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 border text-sm font-semibold"
              style={{ borderColor: 'var(--ielts-border)' }}
              onClick={() => setShowImport((v) => !v)}
            >
              {showImport ? 'Close importer' : '+ Import tests'}
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
              <h3 className="font-bold">Private GitHub repository</h3>
              <p className="text-xs opacity-60 mt-1">
                Reads <span className="font-mono">data/catalog.json</span>, imports every emulator-ready JSON it finds,
                then clears the token. Repository/branch sync history is stored only in this browser.
              </p>

              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                <label className="text-xs">
                  Repository
                  <input
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    className="block w-full border p-2 mt-1 text-sm font-mono"
                    style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-bg)', color: 'var(--ielts-fg)' }}
                    placeholder="owner/repository"
                  />
                </label>
                <label className="text-xs">
                  Branch
                  <input
                    value={githubBranch}
                    onChange={(e) => setGithubBranch(e.target.value)}
                    className="block w-full border p-2 mt-1 text-sm font-mono"
                    style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-bg)', color: 'var(--ielts-fg)' }}
                    placeholder="master"
                  />
                </label>
              </div>

              <label className="block text-xs mt-2">
                Fine-grained PAT (Contents: read)
                <input
                  type="password"
                  autoComplete="off"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="block w-full border p-2 mt-1 text-sm font-mono"
                  style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-bg)', color: 'var(--ielts-fg)' }}
                  placeholder="github_pat_..."
                />
              </label>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  className="px-3 py-1.5 border text-sm font-semibold disabled:opacity-50"
                  style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-accent)', color: 'var(--ielts-accent-fg)' }}
                  onClick={onGithubImport}
                  disabled={githubBusy}
                >
                  {githubBusy ? 'Connecting…' : 'Connect, recognize & import'}
                </button>
                {connection && (
                  <button
                    className="px-3 py-1.5 border text-xs"
                    style={{ borderColor: 'var(--ielts-border)' }}
                    onClick={() => {
                      clearGithubConnection()
                      setConnection(null)
                    }}
                  >
                    Forget browser record
                  </button>
                )}
              </div>

              {connection && (
                <p className="text-xs opacity-60 mt-2">
                  This browser remembers {connection.repository}@{connection.branch}: {connection.recognizedTests} recognized,
                  {' '}{connection.importedTests} imported on {new Date(connection.lastSyncAt).toLocaleString()}.
                </p>
              )}
              {githubMessage && <p className="text-sm mt-2" style={{ color: 'var(--ielts-accent)' }}>{githubMessage}</p>}

              <div className="border-t my-4" style={{ borderColor: 'var(--ielts-border)' }} />

              <label className="block text-sm font-semibold mb-1">Upload a .json file</label>
              <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="text-sm" />

              <div className="text-sm font-semibold mt-4 mb-1">…or paste JSON</div>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                spellCheck={false}
                className="w-full h-40 border p-2 font-mono text-xs"
                style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-bg)', color: 'var(--ielts-fg)' }}
                placeholder='{ "id": "cambridge-18-academic-1", "title": "Cambridge IELTS 18 Academic Test 1", ... }'
              />
              <div className="flex gap-2 mt-2">
                <button
                  className="px-3 py-1.5 border text-sm font-semibold"
                  style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-accent)', color: 'var(--ielts-accent-fg)' }}
                  onClick={() => addTest(paste)}
                >
                  Import JSON
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
