import type { IeltsTest } from '../types'
import { parseTest } from './importTest'

const CONNECTION_KEY = 'ielts-github-connection'
const API_VERSION = '2022-11-28'

export interface GithubConnectionRecord {
  repository: string
  branch: string
  lastSyncAt: string
  recognizedTests: number
  importedTests: number
}

interface GithubContentResponse {
  content?: string
  encoding?: string
  message?: string
}

interface CatalogEntry {
  id: string
  title?: string
  book?: number
  test?: number
  outputPath?: string
  path?: string
  status?: string
}

interface RepoCatalog {
  tests?: CatalogEntry[]
}

export interface GithubImportResult {
  tests: IeltsTest[]
  recognized: number
  missing: CatalogEntry[]
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function fetchRepoText(repository: string, branch: string, path: string, token: string): Promise<string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
  }
  if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`

  const response = await fetch(
    `https://api.github.com/repos/${repository}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
    { headers },
  )

  const data = (await response.json()) as GithubContentResponse
  if (!response.ok) {
    const error = new Error(data.message || `GitHub returned ${response.status}.`) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  if (!data.content || data.encoding !== 'base64') {
    throw new Error(`GitHub did not return file content for ${path}.`)
  }
  return decodeBase64Utf8(data.content)
}

export function loadGithubConnection(): GithubConnectionRecord | null {
  try {
    const raw = localStorage.getItem(CONNECTION_KEY)
    return raw ? (JSON.parse(raw) as GithubConnectionRecord) : null
  } catch {
    return null
  }
}

export function saveGithubConnection(record: GithubConnectionRecord) {
  localStorage.setItem(CONNECTION_KEY, JSON.stringify(record))
}

export function clearGithubConnection() {
  localStorage.removeItem(CONNECTION_KEY)
}

/**
 * Reads data/catalog.json from a repository and imports every emulator-ready
 * JSON file that currently exists. Missing catalog targets are reported, not fatal.
 * The PAT is never persisted by this module.
 */
export async function importFromGithubRepository(
  repository: string,
  branch: string,
  token: string,
): Promise<GithubImportResult> {
  if (!repository.includes('/')) throw new Error('Repository must look like owner/name.')
  if (!token.trim()) throw new Error('Enter a GitHub token with read access to the private repository.')

  const catalogText = await fetchRepoText(repository.trim(), branch.trim() || 'master', 'data/catalog.json', token)
  let catalog: RepoCatalog
  try {
    catalog = JSON.parse(catalogText) as RepoCatalog
  } catch {
    throw new Error('data/catalog.json exists but is not valid JSON.')
  }

  const entries = Array.isArray(catalog.tests) ? catalog.tests : []
  if (entries.length === 0) throw new Error('No tests were listed in data/catalog.json.')

  const imported: IeltsTest[] = []
  const missing: CatalogEntry[] = []

  for (const entry of entries) {
    const path = entry.outputPath || entry.path
    if (!path) {
      missing.push(entry)
      continue
    }
    try {
      const testJson = await fetchRepoText(repository.trim(), branch.trim() || 'master', path, token)
      imported.push(
        parseTest(testJson, {
          provider: 'github',
          repository: repository.trim(),
          path,
          cambridgeBook: entry.book,
          cambridgeTest: entry.test,
        }),
      )
    } catch (error) {
      const status = (error as Error & { status?: number }).status
      if (status === 404) {
        missing.push(entry)
        continue
      }
      throw error
    }
  }

  return { tests: imported, recognized: entries.length, missing }
}
