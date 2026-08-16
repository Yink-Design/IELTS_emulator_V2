import { useStore } from '../../store'
import { allQuestionNumbers, getSections } from '../../lib/sections'
import type { AnswerValue } from '../../types'

export function isAnswered(v: AnswerValue | undefined): boolean {
  if (v == null) return false
  if (Array.isArray(v)) return v.length > 0
  return v.trim().length > 0
}

export default function BottomNav({ onSubmit }: { onSubmit: () => void }) {
  const test = useStore((s) => s.test)
  const module = useStore((s) => s.module)
  const activeSection = useStore((s) => s.activeSection)
  const currentQuestion = useStore((s) => s.currentQuestion)
  const answers = useStore((s) => s.answers)
  const flags = useStore((s) => s.flags)
  const navigateTo = useStore((s) => s.navigateTo)
  const setActiveSection = useStore((s) => s.setActiveSection)
  const reviewMode = useStore((s) => s.reviewMode)
  const backToResults = useStore((s) => s.backToResults)

  if (!test || !module) return null
  const sections = getSections(test, module)
  const isWriting = module === 'writing'

  const flatQs = allQuestionNumbers(sections)
  const idx = flatQs.indexOf(currentQuestion)

  const goPrev = () => {
    if (isWriting) {
      setActiveSection(Math.max(0, activeSection - 1))
    } else if (idx > 0) {
      navigateTo(flatQs[idx - 1])
    }
  }

  const goNext = () => {
    if (isWriting) {
      setActiveSection(Math.min(sections.length - 1, activeSection + 1))
    } else if (idx >= 0 && idx < flatQs.length - 1) {
      navigateTo(flatQs[idx + 1])
    }
  }

  return (
    <footer className="exam-bottom-nav shrink-0 flex items-stretch">
      <div className="flex-1 flex items-stretch overflow-x-auto ielts-scroll">
        {sections.map((sec, i) => {
          const answeredCount = sec.questions.filter((n) => isAnswered(answers[n])).length
          const isActive = i === activeSection

          if (isWriting) {
            return (
              <button
                key={i}
                onClick={() => setActiveSection(i)}
                className="exam-section-tab px-5 text-sm font-bold whitespace-nowrap"
                data-active={isActive}
              >
                {sec.label}
              </button>
            )
          }

          if (!isActive) {
            return (
              <button
                key={i}
                onClick={() => {
                  setActiveSection(i)
                  if (sec.questions[0] != null) navigateTo(sec.questions[0])
                }}
                className="exam-section-tab px-4 text-sm whitespace-nowrap flex flex-col justify-center"
                title={`Go to ${sec.label}`}
              >
                <span className="font-bold">{sec.label}</span>
                <span className="exam-section-count text-xs">
                  {answeredCount} of {sec.questions.length}
                </span>
              </button>
            )
          }

          return (
            <div key={i} className="exam-section-active flex items-center gap-2 px-3">
              <span className="font-bold text-sm whitespace-nowrap">{sec.label}</span>
              <div className="flex items-center gap-1 py-2">
                {sec.questions.map((n) => (
                  <button
                    key={n}
                    className="qbtn"
                    data-answered={isAnswered(answers[n])}
                    data-flagged={!!flags[n]}
                    data-current={n === currentQuestion}
                    onClick={() => navigateTo(n)}
                    title={flags[n] ? `Question ${n} — marked for review` : `Question ${n}`}
                    aria-label={flags[n] ? `Question ${n}, marked for review` : `Question ${n}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="exam-nav-actions flex items-center gap-2 px-3">
        <button
          onClick={reviewMode ? backToResults : onSubmit}
          className="exam-submit-btn px-4 py-1.5 text-sm font-bold"
        >
          {reviewMode ? '← Results' : 'Submit'}
        </button>
        <button
          onClick={goPrev}
          className="exam-arrow-btn w-9 h-9 text-lg leading-none disabled:opacity-30"
          disabled={isWriting ? activeSection === 0 : idx <= 0}
          aria-label="Previous"
        >
          ◀
        </button>
        <button
          onClick={goNext}
          className="exam-arrow-btn w-9 h-9 text-lg leading-none disabled:opacity-30"
          disabled={isWriting ? activeSection === sections.length - 1 : idx >= flatQs.length - 1}
          aria-label="Next"
        >
          ▶
        </button>
      </div>
    </footer>
  )
}
