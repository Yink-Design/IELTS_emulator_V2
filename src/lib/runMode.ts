import type { ModuleType } from '../types'

export type RunMode = 'mock' | 'practice'

const MODE_KEY = 'ielts-run-mode'
const PRACTICE_TIMER_KEY = 'ielts-practice-timer'
const AUDIO_PROGRESS_KEY = 'ielts-listening-progress'

interface StoredPracticeTimer {
  testId: string
  module: ModuleType
  totalMs: number
  sectionMs: Record<string, number>
  currentSection: number
  lastTickAt: number | null
}

type ListeningProgress = Record<string, Record<string, number>>

export interface PracticeTimerSnapshot {
  totalSec: number
  sectionSec: number
}

function readTimer(): StoredPracticeTimer | null {
  try {
    const raw = localStorage.getItem(PRACTICE_TIMER_KEY)
    return raw ? (JSON.parse(raw) as StoredPracticeTimer) : null
  } catch {
    return null
  }
}

function writeTimer(timer: StoredPracticeTimer) {
  try {
    localStorage.setItem(PRACTICE_TIMER_KEY, JSON.stringify(timer))
  } catch {
    /* ignore storage failures */
  }
}

function readListeningProgress(): ListeningProgress {
  try {
    const raw = localStorage.getItem(AUDIO_PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as ListeningProgress) : {}
  } catch {
    return {}
  }
}

function writeListeningProgress(progress: ListeningProgress) {
  try {
    localStorage.setItem(AUDIO_PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    /* ignore storage failures */
  }
}

function snapshot(timer: StoredPracticeTimer, section: number): PracticeTimerSnapshot {
  return {
    totalSec: Math.floor(timer.totalMs / 1000),
    sectionSec: Math.floor((timer.sectionMs[String(section)] ?? 0) / 1000),
  }
}

function addElapsed(timer: StoredPracticeTimer, now: number) {
  if (timer.lastTickAt == null) return
  const delta = Math.max(0, now - timer.lastTickAt)
  timer.totalMs += delta
  const key = String(timer.currentSection)
  timer.sectionMs[key] = (timer.sectionMs[key] ?? 0) + delta
  timer.lastTickAt = now
}

export function getRunMode(): RunMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'practice' ? 'practice' : 'mock'
  } catch {
    return 'mock'
  }
}

export function clearListeningProgress(testId?: string) {
  if (!testId) {
    try {
      localStorage.removeItem(AUDIO_PROGRESS_KEY)
    } catch {
      /* ignore */
    }
    return
  }
  const progress = readListeningProgress()
  delete progress[testId]
  writeListeningProgress(progress)
}

export function saveListeningProgress(testId: string, part: number, seconds: number) {
  const progress = readListeningProgress()
  progress[testId] = progress[testId] ?? {}
  progress[testId][String(part)] = Math.max(0, seconds)
  writeListeningProgress(progress)
}

export function getListeningProgress(testId: string, part: number): number {
  return readListeningProgress()[testId]?.[String(part)] ?? 0
}

export function startRunContext(testId: string, module: ModuleType, mode: RunMode) {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    /* ignore */
  }

  if (module === 'listening') clearListeningProgress(testId)

  if (mode === 'practice') {
    writeTimer({
      testId,
      module,
      totalMs: 0,
      sectionMs: {},
      currentSection: 0,
      lastTickAt: null,
    })
  } else {
    try {
      localStorage.removeItem(PRACTICE_TIMER_KEY)
    } catch {
      /* ignore */
    }
  }
}

/** Resume a practice timer without counting time spent with the page closed. */
export function resumePracticeTimer(testId: string, module: ModuleType, section: number): PracticeTimerSnapshot {
  let timer = readTimer()
  if (!timer || timer.testId !== testId || timer.module !== module) {
    timer = {
      testId,
      module,
      totalMs: 0,
      sectionMs: {},
      currentSection: section,
      lastTickAt: Date.now(),
    }
  } else {
    timer.currentSection = section
    timer.lastTickAt = Date.now()
  }
  writeTimer(timer)
  return snapshot(timer, section)
}

/** Tick the active practice timer and account time to the section currently on screen. */
export function tickPracticeTimer(testId: string, module: ModuleType, section: number): PracticeTimerSnapshot {
  let timer = readTimer()
  const now = Date.now()
  if (!timer || timer.testId !== testId || timer.module !== module) {
    timer = {
      testId,
      module,
      totalMs: 0,
      sectionMs: {},
      currentSection: section,
      lastTickAt: now,
    }
  } else {
    addElapsed(timer, now)
    timer.currentSection = section
    timer.lastTickAt = now
  }
  writeTimer(timer)
  return snapshot(timer, section)
}

/** Pause practice time before deliberately leaving the test or when the page is hidden/unloaded. */
export function pausePracticeTimer() {
  if (getRunMode() !== 'practice') return
  const timer = readTimer()
  if (!timer) return
  addElapsed(timer, Date.now())
  timer.lastTickAt = null
  writeTimer(timer)
}

export function getPracticeTimerSnapshot(section = 0): PracticeTimerSnapshot {
  const timer = readTimer()
  if (!timer) return { totalSec: 0, sectionSec: 0 }
  return snapshot(timer, section)
}
