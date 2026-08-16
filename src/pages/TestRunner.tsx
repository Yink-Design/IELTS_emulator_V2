import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { getSections, allQuestionNumbers } from '../lib/sections'
import TopBar from '../components/shell/TopBar'
import BottomNav, { isAnswered } from '../components/shell/BottomNav'
import ReadingTest from '../components/modules/ReadingTest'
import ListeningTest from '../components/modules/ListeningTest'
import WritingTest from '../components/modules/WritingTest'
import NotesPanel from '../components/reading/NotesPanel'

function ConfirmSubmit({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const test = useStore((s) => s.test)
  const module = useStore((s) => s.module)
  const answers = useStore((s) => s.answers)

  const sections = test && module ? getSections(test, module) : []
  const allQ = allQuestionNumbers(sections)
  const answered = allQ.filter((n) => isAnswered(answers[n])).length
  const isWriting = module === 'writing'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div
        className="w-[28rem] max-w-[90vw] border shadow-xl p-6"
        style={{ background: 'var(--ielts-panel)', color: 'var(--ielts-panel-fg)', borderColor: 'var(--ielts-border)' }}
      >
        <h2 className="text-lg font-bold mb-2">Submit test?</h2>
        {isWriting ? (
          <p className="text-sm mb-5">Once you submit you cannot change your answers.</p>
        ) : (
          <p className="text-sm mb-5">
            You have answered <span className="font-bold">{answered}</span> of {allQ.length} questions.
            {answered < allQ.length && ' Unanswered questions will be marked wrong.'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button className="px-4 py-1.5 border" style={{ borderColor: 'var(--ielts-border)' }} onClick={onCancel}>
            Keep working
          </button>
          <button
            className="px-4 py-1.5 font-bold border"
            style={{ borderColor: 'var(--ielts-border)', background: 'var(--ielts-accent)', color: 'var(--ielts-accent-fg)' }}
            onClick={onConfirm}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TestRunner() {
  const module = useStore((s) => s.module)
  const submit = useStore((s) => s.submit)
  const reviewMode = useStore((s) => s.reviewMode)
  const [confirm, setConfirm] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

  useEffect(() => {
    const openNotes = () => setNotesOpen(true)
    window.addEventListener('ielts-open-notes', openNotes)
    return () => window.removeEventListener('ielts-open-notes', openNotes)
  }, [])

  useEffect(() => {
    if (module !== 'reading') setNotesOpen(false)
  }, [module])

  useEffect(() => {
    if (reviewMode) return
    const warnBeforeLeaving = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [reviewMode])

  const doSubmit = () => {
    setConfirm(false)
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    submit()
  }

  return (
    <>
      <TopBar notesOpen={notesOpen} onToggleNotes={() => setNotesOpen((v) => !v)} />
      {reviewMode && (
        <div
          className="shrink-0 px-4 py-1.5 text-sm font-bold border-b flex items-center gap-3"
          style={{ background: 'var(--ielts-panel)', color: 'var(--ielts-panel-fg)', borderColor: 'var(--ielts-border)' }}
        >
          <span>Review mode — your answers are marked <span className="rev-tick">✓</span> correct / <span className="rev-cross">✗</span> incorrect, with the right answer shown.</span>
        </div>
      )}
      <main className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {module === 'reading' && <ReadingTest />}
          {module === 'listening' && <ListeningTest />}
          {module === 'writing' && <WritingTest />}
        </div>
        {module === 'reading' && notesOpen && <NotesPanel onClose={() => setNotesOpen(false)} />}
      </main>
      <BottomNav onSubmit={() => setConfirm(true)} />
      {confirm && <ConfirmSubmit onCancel={() => setConfirm(false)} onConfirm={doSubmit} />}
    </>
  )
}
