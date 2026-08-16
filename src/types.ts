// ---------------------------------------------------------------------------
// Data model for an IELTS test. A single JSON-serialisable `IeltsTest` carries
// every module (Listening / Reading / Writing). Speaking is a face-to-face /
// video interview in the real exam and is not part of the computer-delivered
// session, so it is intentionally omitted.
// ---------------------------------------------------------------------------

export type ModuleType = 'listening' | 'reading' | 'writing'
export type TestCategory = 'academic' | 'general'

export type ColorTheme = 'default' | 'white-on-black' | 'yellow-on-black'
export type FontSize = 'standard' | 'large' | 'xlarge'

export interface IeltsTest {
  id: string
  title: string
  category: TestCategory
  /** Optional source/attribution note shown on the home screen. */
  source?: string
  /** Flags older tests with short, condensed passages (vs full ~700-word ones). */
  simplified?: boolean
  listening?: ListeningModule
  reading?: ReadingModule
  writing?: WritingModule
}

// --- Listening -------------------------------------------------------------

export interface ListeningModule {
  /** Seconds. Real CBT ≈ 30 min audio + 2 min check. */
  durationSec: number
  parts: ListeningPart[]
  /** qNumber -> accepted answer(s). Used for auto-marking. */
  answerKey: AnswerKey
}

/** One speaker turn in a dialogue. `speaker` is a voice id (see VOICE_MAP). */
export interface TranscriptTurn {
  speaker: string
  text: string
}

export interface ListeningPart {
  number: 1 | 2 | 3 | 4
  /** Audio clip URL for this part (plays once, cannot be paused — like the
   *  exam). Optional: if absent, `transcript` is read aloud via the browser's
   *  speech synthesis so the sim works without copyrighted audio files. */
  audio?: string
  /**
   * Spoken script, used for generating the audio and for text-to-speech
   * fallback. A plain string is a single-voice monologue. An array is a
   * dialogue: each item is either a bare string (voiced by the next speaker in
   * `speakers`, rotating) or an explicit `{ speaker, text }` turn.
   */
  transcript?: string | Array<string | TranscriptTurn>
  /** Voice ids to rotate through for bare-string turns, e.g. ['M','W']. */
  speakers?: string[]
  /** e.g. "Questions 1–10". */
  heading: string
  /** Short scenario blurb shown above the questions. */
  context?: string
  groups: QuestionGroup[]
}

// --- Reading ---------------------------------------------------------------

export interface ReadingModule {
  durationSec: number // 3600
  passages: ReadingPassage[]
  answerKey: AnswerKey
}

export interface ReadingPassage {
  number: 1 | 2 | 3
  heading: string // "Reading Passage 1"
  title: string
  /** Passage body as HTML. Paragraphs may be wrapped to show A, B, C labels. */
  html: string
  groups: QuestionGroup[]
}

// --- Writing ---------------------------------------------------------------

export interface WritingModule {
  durationSec: number // 3600
  tasks: WritingTask[]
}

export interface WritingTask {
  number: 1 | 2
  minWords: number
  promptHtml: string
  /** Task 1 Academic chart/diagram image. */
  imageUrl?: string
}

// --- Questions -------------------------------------------------------------

export type QuestionType =
  | 'mcq-single' // radio, one answer
  | 'mcq-multi' // checkboxes, choose N
  | 'gap-fill' // standalone sentence completion / short completion lines
  | 'inline-gap' // gaps embedded in bodyHtml (notes / summary / form / table / flow-chart)
  | 'diagram-completion' // free-text labels based on a diagram/image
  | 'tfng' // True / False / Not Given
  | 'ynng' // Yes / No / Not Given
  | 'matching' // match prompts to a shared bank (information, features, endings)
  | 'matching-headings' // match headings to paragraphs
  | 'map-labeling' // label a map / plan / diagram from a supplied option bank
  | 'short-answer' // answer a question in N words

export interface Option {
  value: string // 'A', 'TRUE', etc.
  label: string
}

export interface QuestionGroup {
  id: string
  type: QuestionType
  /** Instruction line(s), e.g. "Choose TWO letters, A–E." */
  instructions: string
  /** Word/number limit note, e.g. "NO MORE THAN TWO WORDS AND/OR A NUMBER". */
  wordLimit?: string
  /** Shared option bank (matching / map-labeling / matching-headings). */
  options?: Option[]
  /** Map / plan / diagram image. Private-bank images may use bank://assets/... */
  imageUrl?: string
  /**
   * For inline-gap groups: body HTML containing {{n}} placeholders that are
   * replaced with input boxes for question number n.
   */
  bodyHtml?: string
  questions: Question[]
}

export interface Question {
  number: number // global 1..40
  /** Stem/label text. Omitted for inline-gap if the gap sits in bodyHtml. */
  text?: string
  /** Per-question options (mcq). */
  options?: Option[]
  /** For mcq-multi: how many to choose. */
  maxSelect?: number
  /** Reading only: the exact sentence/phrase in the passage that justifies the
   *  answer. Shown in review mode — clicking the question scrolls to it and
   *  highlights it. Must match the passage plain text verbatim. */
  evidence?: string
}

/** Accepted answer(s) per question number. Marking is case-insensitive and
 *  trims whitespace; an array means any listed variant is accepted. */
export type AnswerKey = Record<number, string | string[]>

// --- Runtime state ---------------------------------------------------------

export type AnswerValue = string | string[]
export type Answers = Record<number, AnswerValue>
export type Flags = Record<number, boolean>

/** Highlighter pen colours offered in the select menu. */
export type HighlightColor = 'yellow' | 'green' | 'pink'

export interface Highlight {
  id: string
  passage: number
  /** Character offsets within the passage's text content, so the highlight can
   *  be re-applied after a reload. */
  start: number
  end: number
  note?: string
  /** Pen colour; defaults to yellow for highlights saved before colours. */
  color?: HighlightColor
}

export interface Settings {
  colorTheme: ColorTheme
  fontSize: FontSize
  showTimer: boolean
}
