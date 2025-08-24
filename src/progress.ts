import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs"
import { AnalyzedCommit } from "./types"

interface ProgressState {
  totalCommits: string[]
  processedCommits: string[]
  analyzedCommits: AnalyzedCommit[]
  lastProcessedIndex: number
  startTime: string
  outputFile: string
}

export class ProgressTracker {
  private static readonly CHECKPOINT_FILE = ".commit-analyzer-progress.json"

  static saveProgress(
    totalCommits: string[],
    processedCommits: string[],
    analyzedCommits: AnalyzedCommit[],
    outputFile: string,
  ): void {
    let startTime = new Date().toISOString()
    const existingState = this.loadProgress()
    if (existingState) {
      startTime = existingState.startTime
    }

    const state: ProgressState = {
      totalCommits,
      processedCommits,
      analyzedCommits,
      lastProcessedIndex: processedCommits.length - 1,
      startTime,
      outputFile,
    }

    writeFileSync(this.CHECKPOINT_FILE, JSON.stringify(state, null, 2))
  }

  static loadProgress(): ProgressState | null {
    if (!existsSync(this.CHECKPOINT_FILE)) {
      return null
    }

    try {
      const content = readFileSync(this.CHECKPOINT_FILE, "utf8")
      return JSON.parse(content)
    } catch (error) {
      console.error("Failed to load progress file:", error)
      return null
    }
  }

  static hasProgress(): boolean {
    return existsSync(this.CHECKPOINT_FILE)
  }

  static clearProgress(): void {
    if (existsSync(this.CHECKPOINT_FILE)) {
      unlinkSync(this.CHECKPOINT_FILE)
    }
  }

  static getRemainingCommits(state: ProgressState): string[] {
    const processedSet = new Set(state.processedCommits)
    return state.totalCommits.filter((hash) => !processedSet.has(hash))
  }

  static formatProgressSummary(state: ProgressState): string {
    const processed = state.processedCommits.length
    const total = state.totalCommits.length
    const remaining = total - processed
    const percentComplete = Math.round((processed / total) * 100)

    return `
      Previous session:
      - Started: ${new Date(state.startTime).toLocaleString()}
      - Progress: ${processed}/${total} commits (${percentComplete}%)
      - Remaining: ${remaining} commits
      - Output file: ${state.outputFile}
    `.trim()
  }
}

