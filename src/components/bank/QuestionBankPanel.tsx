import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store'
import { loadSession } from '../../lib/session'
import { startRunContext, type RunMode } from '../../lib/runMode'
import {
  clearQuestionBankToken,
  loadQuestionBankConfig,
  loadQuestionBankManifest,
  loadQuestionBankTest,
  saveQuestionBankConfig,
  type QuestionBankConfig,
  type QuestionBankEntry,
  type QuestionBankManifest,
} from '../../lib/questionBank'
import type { IeltsTest, ModuleType } from '../../types'

const MODULE_LABEL: Record<ModuleType, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
}

function supports(entry: QuestionBankEntry, module: ModuleType): boolean {
  return !entry.availableModules || entry.availableModules.includes(module)
}

export default function QuestionBankPanel({
  module,
  onLoadedTest,
}: {
  module: ModuleType
  onLoadedTest: (test: IeltsTest) => void
}) {
  const [config, setConfig] = useState<QuestionBankConfig>(() => loadQuestionBankConfig())
  const [manifest, setManifest] = useState<QuestionBankManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(() => !loadQuestionBankConfig().repo)
  const loadAndStart = useStore((s) => s.loadAndStart)

  const connect = async (next = config, autoResume = true) => {
    setConnecting(true)
    setError(null)
    try {
      saveQuestionBankConfig(next)
      const loaded = await loadQuestionBankManifest(next)
      setManifest(loaded)
      setShowSetup(false)

      // If the browser has a saved in-progress remote test, materialise that
      // test immediately after reconnect so the normal Resume card can find it.
      if (autoResume) {
        const session = loadSession()
        const entry = session ? loaded.tests.find((t) => t.id === session.testId) : undefined
        if (entry) {
          setLoadingId(entry.id)
          const test = await loadQuestionBankTest(next, entry)
          onLoadedTest(test)
        }
      }
    } catch (e) {
      setManifest(null)
      setError(e instanceof Error ? e.message : 'Unable to connect to question bank.')
      setShowSetup(true)
    } finally {
      setConnecting(false)
      setLoadingId(null)
    }
  }

  useEffect(() => {
    const initial = loadQuestionBankConfig()
    if (initial.owner && initial.repo && initial.token) void connect(initial, true)
    // Auto-connect once on Home mount. Subsequent changes use the Connect button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = useMemo(
    () => manifest?.tests.filter((entry) => supports(entry, module)) ?? [],
    [manifest, module],
  )

  const startRemote = async (entry: QuestionBankEntry, mode: RunMode) => {
    setLoadingId(entry.id)
    setError(null)
    try {
      const test = await loadQuestionBankTest(config, entry)
      onLoadedTest(test)
      startRunContext(test.id, module, mode)
      loadAndStart(test, module)
      if (mode === 'practice') useStore.setState({ endsAt: null })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load this test.')
    } finally {
      setLoadingId(null)
    }
  }

  const disconnect = () => {
    clearQuestionBankToken()
    setManifest(null)
    setConfig((s) => ({ ...s, token: '' }))
    setShowSetup(true)
  }

  return (
    <section className="mt-6 border" style={{ borderColor: 'var(--ielts-border)' }}>
      <div
        className="px-4 py-3 flex items-center justify-between gap-3 border-b"
        style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-panel)' }}
      >
        <div>
          <div className="font-bold">Private question bank</div>
          <div className="text-xs opacity-60 mt-0.5">
            {manifest
              ? `${manifest.title ?? `${config.owner}/${config.repo}`} · ${manifest.tests.length} tests`
              : 'Load test JSON and private assets from a separate GitHub repository.'}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {manifest && (
            <button
              className="px-3 py-1.5 border text-sm"
              style={{ borderColor: 'var(--ielts-border)' }}
              onClick={() => void connect(config, false)}
              disabled={connecting}
            >
              Refresh
            </button>
          )}
          <button
            className="px-3 py-1.5 border text-sm"
            style={{ borderColor: 'var(--ielts-border)' }}
            onClick={() => setShowSetup((v) => !v)}
          >
            {showSetup ? 'Hide setup' : 'Setup'}
          </button>
        </div>
      </div>

      {showSetup && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--ielts-border)' }}>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block font-semibold mb-1">GitHub owner</span>
              <input
                value={config.owner}
                onChange={(e) => setConfig((s) => ({ ...s, owner: e.target.value }))}
                className="w-full border px-2 py-1.5"
                style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-bg)', color: 'var(--ielts-fg)' }}
                placeholder="Yink-Design"
              />
            </label>
            <label className="text-sm">
              <span className="block font-semibold mb-1">Private repository</span>
              <input
                value={config.repo}
                onChange={(e) => setConfig((s) => ({ ...s, repo: e.target.value }))}
                className="w-full border px-2 py-1.5"
                style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-bg)', color: 'var(--ielts-fg)' }}
                placeholder="IELTS_question_bank_private"
              />
            </label>
            <label className="text-sm">
              <span className="block font-semibold mb-1">Branch</span>
              <input
                value={config.branch}
                onChange={(e) => setConfig((s) => ({ ...s, branch: e.target.value }))}
                className="w-full border px-2 py-1.5"
                style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-bg)', color: 'var(--ielts-fg)' }}
                placeholder="main"
              />
            </label>
            <label className="text-sm">
              <span className="block font-semibold mb-1">Fine-grained token</span>
              <input
                type="password"
                value={config.token}
                onChange={(e) => setConfig((s) => ({ ...s, token: e.target.value }))}
                className="w-full border px-2 py-1.5 font-mono"
                style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-bg)', color: 'var(--ielts-fg)' }}
                placeholder="github_pat_..."
                autoComplete="off"
              />
            </label>
          </div>

          <label className="flex items-start gap-2 text-sm mt-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={config.rememberToken}
              onChange={(e) => setConfig((s) => ({ ...s, rememberToken: e.target.checked }))}
            />
            <span>
              <strong>Remember token on this device.</strong>{' '}
              Recommended for crash recovery after closing the tab. Use a fine-grained token restricted to this one private repository with read-only Contents permission.
            </span>
          </label>

          <div className="flex gap-2 mt-4">
            <button
              className="px-3 py-1.5 border text-sm font-semibold"
              style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-accent)', color: 'var(--ielts-accent-fg)' }}
              onClick={() => void connect(config, true)}
              disabled={connecting}
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
            {(manifest || config.token) && (
              <button
                className="px-3 py-1.5 border text-sm"
                style={{ borderColor: 'var(--ielts-border)' }}
                onClick={disconnect}
              >
                Forget token
              </button>
            )}
          </div>
          <p className="text-xs opacity-55 mt-3">
            The token is never committed to the simulator repository. Without “Remember”, it is kept in sessionStorage only.
          </p>
        </div>
      )}

      {manifest && (
        <div className="p-4">
          <div className="font-semibold text-sm mb-2">{MODULE_LABEL[module]} tests</div>
          {visible.length === 0 ? (
            <p className="text-sm opacity-60">No {MODULE_LABEL[module]} tests are listed in the bank manifest.</p>
          ) : (
            <div className="grid gap-2">
              {visible.map((entry) => {
                const busy = loadingId === entry.id
                return (
                  <div key={entry.id} className="border p-3" style={{ borderColor: 'var(--ielts-border)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold">{entry.title}</div>
                        <div className="text-xs opacity-60 mt-0.5">
                          {entry.scheduledFrom ? `Scheduled from ${entry.scheduledFrom}` : entry.path}
                          {entry.source ? ` · ${entry.source}` : ''}
                        </div>
                      </div>
                      {busy && <span className="text-xs opacity-60">Loading assets…</span>}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        className="px-3 py-1.5 border text-sm font-semibold"
                        style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-accent)', color: 'var(--ielts-accent-fg)' }}
                        disabled={busy}
                        onClick={() => void startRemote(entry, 'practice')}
                      >
                        Practice
                      </button>
                      <button
                        className="px-3 py-1.5 border text-sm font-semibold"
                        style={{ borderColor: 'var(--ielts-border)' }}
                        disabled={busy}
                        onClick={() => void startRemote(entry, 'mock')}
                      >
                        Mock test
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {error && <div className="px-4 pb-4 text-sm text-rose-600">{error}</div>}
    </section>
  )
}
