import type { IeltsTest } from '../types'

const IMPORTED_KEY = 'ielts-imported-tests'

/** Parse and lightly validate a user-supplied test JSON. Throws on problems. */
export function parseTest(json: string): IeltsTest {
  let obj: unknown
  try {
    obj = JSON.parse(json)
  } catch {
    throw new Error('That is not valid JSON.')
  }
  const t = obj as Partial<IeltsTest>
  if (!t || typeof t !== 'object') throw new Error('Test must be a JSON object.')
  if (!t.id || !t.title) throw new Error('Test needs an "id" and a "title".')
  if (!t.listening && !t.reading && !t.writing) {
    throw new Error('Test must contain at least one of: listening, reading, writing.')
  }
  if (!t.category) t.category = 'academic'
  return t as IeltsTest
}

export function loadImportedTests(): IeltsTest[] {
  try {
    const raw = localStorage.getItem(IMPORTED_KEY)
    if (raw) return JSON.parse(raw) as IeltsTest[]
  } catch {
    /* ignore */
  }
  return []
}

export function saveImportedTests(tests: IeltsTest[]) {
  localStorage.setItem(IMPORTED_KEY, JSON.stringify(tests))
}

/** A minimal but complete template demonstrating the JSON format. */
export function templateJson(): string {
  const template: IeltsTest = {
    id: 'my-test-1',
    title: 'My Imported Test',
    category: 'academic',
    source: 'Content I legally own.',
    reading: {
      durationSec: 3600,
      answerKey: { 1: 'TRUE', 2: ['glass', 'a glass'], 3: 'valve' },
      passages: [
        {
          number: 1,
          heading: 'Reading Passage 1',
          title: 'Example passage',
          html: '<p><span class="passage-letter">A</span> Put your passage HTML here. Wrap paragraph letters in &lt;span class="passage-letter"&gt;.</p>',
          groups: [
            {
              id: 'g1',
              type: 'tfng',
              instructions: 'Do the statements agree with the passage?',
              questions: [{ number: 1, text: 'A True/False/Not Given statement.' }],
            },
            {
              id: 'g2',
              type: 'inline-gap',
              instructions: 'Complete the summary.',
              wordLimit: 'NO MORE THAN TWO WORDS',
              bodyHtml: '<p>The bottle is made of {{2}}.</p>',
              questions: [{ number: 2 }],
            },
            {
              id: 'g3',
              type: 'diagram-completion',
              instructions: 'Label the diagram below.',
              wordLimit: 'ONE WORD ONLY',
              imageUrl: 'https://example.com/diagram.png',
              questions: [{ number: 3, text: 'Part marked 3: ___' }],
            },
          ],
        },
      ],
    },
    writing: {
      durationSec: 3600,
      tasks: [{ number: 1, minWords: 150, promptHtml: '<p>Task 1 prompt…</p>' }],
    },
  }
  return JSON.stringify(template, null, 2)
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadTemplate() {
  download('ielts-test-template.json', templateJson())
}
