import { useMemo } from 'react'
import { useStore } from '../../store'

function htmlToText(html: string): string {
  const el = document.createElement('div')
  el.innerHTML = html
  return el.textContent ?? ''
}

export default function NotesPanel({ onClose }: { onClose: () => void }) {
  const test = useStore((s) => s.test)
  const highlights = useStore((s) => s.highlights)
  const setHighlightNote = useStore((s) => s.setHighlightNote)

  const notes = useMemo(() => {
    if (!test?.reading) return []
    const passageText = new Map<number, string>(
      test.reading.passages.map((p) => [p.number, htmlToText(p.html)]),
    )
    return highlights
      .filter((h) => h.note !== undefined)
      .map((h) => {
        const text = passageText.get(h.passage) ?? ''
        const selected = text.slice(h.start, h.end).replace(/\s+/g, ' ').trim()
        return { ...h, selected }
      })
  }, [test, highlights])

  return (
    <aside
      className="notes-panel shrink-0 border-l flex flex-col"
      style={{ width: '320px', background: 'var(--ielts-panel)', borderColor: 'var(--ielts-border)' }}
      aria-label="Notes"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--ielts-border)' }}>
        <div>
          <div className="font-bold text-sm">Notes</div>
          <div className="text-xs opacity-60">Reading annotations</div>
        </div>
        <button className="exam-tool-btn" onClick={onClose} aria-label="Close notes">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 ielts-scroll">
        {notes.length === 0 ? (
          <div className="text-sm opacity-65 leading-relaxed">
            Select text in a reading passage and choose <strong>+ Note</strong>. Your notes will appear here and are saved with the test session.
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="border bg-[var(--ielts-bg)]" style={{ borderColor: 'var(--ielts-border)' }}>
                <div className="px-2 py-1.5 border-b" style={{ borderColor: 'var(--ielts-border)' }}>
                  <div className="text-xs font-bold">Passage {note.passage}</div>
                  {note.selected && (
                    <div className="text-xs opacity-65 mt-1 line-clamp-3">“{note.selected}”</div>
                  )}
                </div>
                <textarea
                  value={note.note ?? ''}
                  onChange={(e) => setHighlightNote(note.id, e.target.value)}
                  placeholder="Type your note…"
                  className="w-full min-h-24 p-2 text-sm resize-y outline-none"
                  style={{ background: 'var(--ielts-bg)', color: 'var(--ielts-fg)' }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
