import type { IeltsTest } from '../types'

const IMPORTED_KEY = 'ielts-imported-tests'

export type ExternalImportProvider = 'file' | 'github'

export interface ExternalImportMeta {
  provider: ExternalImportProvider
  repository?: string
  path?: string
  cambridgeBook?: number
  cambridgeTest?: number
  importedAt: string
}

type ExternalIeltsTest = IeltsTest & { importMeta?: ExternalImportMeta }

export interface ParseTestOptions {
  provider?: ExternalImportProvider
  repository?: string
  path?: string
  cambridgeBook?: number
  cambridgeTest?: number
}

function inferCambridgeReference(...values: Array<string | undefined>): { book?: number; test?: number } {
  const text = values.filter(Boolean).join(' ')
  const bookMatch = text.match(/(?:cambridge(?:\s+ielts)?|剑(?:雅)?)[\s_-]*(\d{1,2})/i)
  const testMatch = text.match(/(?:test|t)[\s_-]*(\d{1,2})/i)
  return {
    book: bookMatch ? Number(bookMatch[1]) : undefined,
    test: testMatch ? Number(testMatch[1]) : undefined,
  }
}

export function getImportMeta(test: IeltsTest): ExternalImportMeta | undefined {
  return (test as ExternalIeltsTest).importMeta
}

/** Parse and lightly validate a user-supplied test JSON. Throws on problems. */
export function parseTest(json: string, options: ParseTestOptions = {}): IeltsTest {
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

  if (options.provider) {
    const inferred = inferCambridgeReference(t.id, t.title, t.source, options.path)
    ;(t as ExternalIeltsTest).importMeta = {
      provider: options.provider,
      repository: options.repository,
      path: options.path,
      cambridgeBook: options.cambridgeBook ?? inferred.book,
      cambridgeTest: options.cambridgeTest ?? inferred.test,
      importedAt: new Date().toISOString(),
    }
  }

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
  try {
    localStorage.setItem(IMPORTED_KEY, JSON.stringify(tests))
  } catch {
    throw new Error('Browser storage is full. Remove some imported tests and try again.')
  }
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
      answerKey: { 1: 'TRUE', 2: ['glass', 'a glass'] },
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
