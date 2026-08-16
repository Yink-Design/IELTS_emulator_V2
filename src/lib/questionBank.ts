import { parseTest } from './importTest'
import type { IeltsTest, QuestionGroup } from '../types'

export interface QuestionBankConfig {
  owner: string
  repo: string
  branch: string
  token: string
  rememberToken: boolean
}

export interface QuestionBankEntry {
  id: string
  title: string
  path: string
  availableModules?: Array<'listening' | 'reading' | 'writing'>
  scheduledFrom?: string
  source?: string
}

export interface QuestionBankManifest {
  schemaVersion: number
  title?: string
  tests: QuestionBankEntry[]
}

const CONFIG_KEY = 'ielts-question-bank-config'
const TOKEN_SESSION_KEY = 'ielts-question-bank-token-session'
const TOKEN_LOCAL_KEY = 'ielts-question-bank-token-local'
const BANK_PREFIX = 'bank://'

interface StoredConfig {
  owner: string
  repo: string
  branch: string
  rememberToken: boolean
}

interface GithubContentFile {
  type: 'file'
  content?: string
  encoding?: string
  git_url?: string
  download_url?: string | null
  name?: string
}

function encodeRepoPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

function headers(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function decodeBase64Bytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function decodeBase64Text(value: string): string {
  return new TextDecoder().decode(decodeBase64Bytes(value))
}

async function githubJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: headers(token) })
  if (!response.ok) {
    if (response.status === 401) throw new Error('Question bank authentication failed. Check the token.')
    if (response.status === 403) throw new Error('GitHub denied access. The token needs read access to this repository.')
    if (response.status === 404) throw new Error('Question bank file or repository was not found.')
    throw new Error(`GitHub question bank request failed (${response.status}).`)
  }
  return response.json() as Promise<T>
}

async function fetchRepoFile(config: QuestionBankConfig, path: string): Promise<GithubContentFile> {
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(config.branch || 'main')}`
  const item = await githubJson<GithubContentFile | GithubContentFile[]>(url, config.token)
  if (Array.isArray(item) || item.type !== 'file') throw new Error(`Question bank path is not a file: ${path}`)
  return item
}

async function readRepoText(config: QuestionBankConfig, path: string): Promise<string> {
  const item = await fetchRepoFile(config, path)
  if (item.encoding === 'base64' && item.content) return decodeBase64Text(item.content)
  if (item.git_url) {
    const blob = await githubJson<{ content: string; encoding: string }>(item.git_url, config.token)
    if (blob.encoding === 'base64' && blob.content) return decodeBase64Text(blob.content)
  }
  throw new Error(`Unable to read question bank text file: ${path}`)
}

function mimeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'm4a') return 'audio/mp4'
  if (ext === 'wav') return 'audio/wav'
  if (ext === 'ogg') return 'audio/ogg'
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'svg') return 'image/svg+xml'
  return 'application/octet-stream'
}

async function readRepoBlobUrl(config: QuestionBankConfig, path: string): Promise<string> {
  const item = await fetchRepoFile(config, path)
  let bytes: Uint8Array | null = null
  if (item.encoding === 'base64' && item.content) bytes = decodeBase64Bytes(item.content)
  if (!bytes && item.git_url) {
    const blob = await githubJson<{ content: string; encoding: string }>(item.git_url, config.token)
    if (blob.encoding === 'base64' && blob.content) bytes = decodeBase64Bytes(blob.content)
  }
  if (!bytes) throw new Error(`Unable to download question bank asset: ${path}`)
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeFor(path) }))
  return objectUrl
}

function bankPath(value: string): string | null {
  return value.startsWith(BANK_PREFIX) ? value.slice(BANK_PREFIX.length).replace(/^\/+/, '') : null
}

async function rewriteHtmlAssets(html: string | undefined, resolve: (value: string) => Promise<string>): Promise<string | undefined> {
  if (!html || !html.includes(BANK_PREFIX)) return html
  const matches = [...html.matchAll(/\bsrc=(['"])(bank:\/\/[^'"]+)\1/gi)]
  let next = html
  for (const match of matches) {
    const original = match[2]
    const resolved = await resolve(original)
    next = next.split(original).join(resolved)
  }
  return next
}

async function materializeGroup(group: QuestionGroup, resolve: (value: string) => Promise<string>): Promise<void> {
  if (group.imageUrl) group.imageUrl = await resolve(group.imageUrl)
  group.bodyHtml = await rewriteHtmlAssets(group.bodyHtml, resolve)
}

/**
 * Resolve private-repository assets into in-memory blob URLs. Test JSON should
 * refer to private assets as bank://assets/.... Nothing from the private bank
 * is copied into the public simulator repository.
 */
async function materializePrivateAssets(test: IeltsTest, config: QuestionBankConfig): Promise<IeltsTest> {
  const cache = new Map<string, Promise<string>>()
  const resolve = async (value: string): Promise<string> => {
    const path = bankPath(value)
    if (!path) return value
    if (!cache.has(path)) cache.set(path, readRepoBlobUrl(config, path))
    return cache.get(path)!
  }

  if (test.listening) {
    for (const part of test.listening.parts) {
      if (part.audio) part.audio = await resolve(part.audio)
      for (const group of part.groups) await materializeGroup(group, resolve)
    }
  }
  if (test.reading) {
    for (const passage of test.reading.passages) {
      passage.html = (await rewriteHtmlAssets(passage.html, resolve)) ?? passage.html
      for (const group of passage.groups) await materializeGroup(group, resolve)
    }
  }
  if (test.writing) {
    for (const task of test.writing.tasks) {
      if (task.imageUrl) task.imageUrl = await resolve(task.imageUrl)
      task.promptHtml = (await rewriteHtmlAssets(task.promptHtml, resolve)) ?? task.promptHtml
    }
  }
  return test
}

export function loadQuestionBankConfig(): QuestionBankConfig {
  let stored: StoredConfig = { owner: '', repo: '', branch: 'main', rememberToken: false }
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) stored = { ...stored, ...(JSON.parse(raw) as Partial<StoredConfig>) }
  } catch {
    /* ignore */
  }

  let token = ''
  try {
    token = stored.rememberToken
      ? localStorage.getItem(TOKEN_LOCAL_KEY) ?? ''
      : sessionStorage.getItem(TOKEN_SESSION_KEY) ?? ''
  } catch {
    /* ignore */
  }
  return { ...stored, token }
}

export function saveQuestionBankConfig(config: QuestionBankConfig) {
  const stored: StoredConfig = {
    owner: config.owner.trim(),
    repo: config.repo.trim(),
    branch: config.branch.trim() || 'main',
    rememberToken: config.rememberToken,
  }
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(stored))
    if (config.rememberToken) {
      localStorage.setItem(TOKEN_LOCAL_KEY, config.token)
      sessionStorage.removeItem(TOKEN_SESSION_KEY)
    } else {
      sessionStorage.setItem(TOKEN_SESSION_KEY, config.token)
      localStorage.removeItem(TOKEN_LOCAL_KEY)
    }
  } catch {
    /* ignore */
  }
}

export function clearQuestionBankToken() {
  try {
    sessionStorage.removeItem(TOKEN_SESSION_KEY)
    localStorage.removeItem(TOKEN_LOCAL_KEY)
  } catch {
    /* ignore */
  }
}

export async function loadQuestionBankManifest(config: QuestionBankConfig): Promise<QuestionBankManifest> {
  if (!config.owner || !config.repo || !config.token) throw new Error('Owner, repository and token are required.')
  const text = await readRepoText(config, 'manifest.json')
  const manifest = JSON.parse(text) as QuestionBankManifest
  if (!manifest || !Array.isArray(manifest.tests)) throw new Error('Invalid question bank manifest.json.')
  return manifest
}

export async function loadQuestionBankTest(config: QuestionBankConfig, entry: QuestionBankEntry): Promise<IeltsTest> {
  const text = await readRepoText(config, entry.path)
  const test = parseTest(text)
  return materializePrivateAssets(test, config)
}
