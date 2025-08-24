import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs"
import { AnalyzedCommit } from "./types"
import { calculatePercentage } from "./utils"

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
  private static readonly FILE_ENCODING = "utf8"
  private static readonly JSON_INDENT = 2

  static saveProgress(
    totalCommits: string[],
    processedCommits: string[],
    analyzedCommits: AnalyzedCommit[],
    outputFile: string,
  ): void {
    const state = this.createProgressState(
      totalCommits,
      processedCommits,
      analyzedCommits,
      outputFile,
    )
    this.writeProgressToFile(state)
  }

  private static createProgressState(
    totalCommits: string[],
    processedCommits: string[],
    analyzedCommits: AnalyzedCommit[],
    outputFile: string,
  ): ProgressState {
    const existingState = this.loadProgress()
    const startTime = existingState?.startTime || new Date().toISOString()

    return {
      totalCommits,
      processedCommits,
      analyzedCommits,
      lastProcessedIndex: processedCommits.length - 1,
      startTime,
      outputFile,
    }
  }

  private static writeProgressToFile(state: ProgressState): void {
    const content = JSON.stringify(state, null, this.JSON_INDENT)
    writeFileSync(this.CHECKPOINT_FILE, content)
  }

  static loadProgress(): ProgressState | null {
    if (!this.hasProgress()) {
      return null
    }

    return this.readProgressFromFile()
  }

  private static readProgressFromFile(): ProgressState | null {
    try {
      const content = readFileSync(this.CHECKPOINT_FILE, this.FILE_ENCODING)
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
    if (this.hasProgress()) {
      unlinkSync(this.CHECKPOINT_FILE)
    }
  }

  static getRemainingCommits(state: ProgressState): string[] {
    const processedSet = new Set(state.processedCommits)
    return state.totalCommits.filter((hash) => !processedSet.has(hash))
  }

  static formatProgressSummary(state: ProgressState): string {
    const stats = this.calculateProgressStats(state)
    
    return `
      Previous session:
      - Started: ${new Date(state.startTime).toLocaleString()}
      - Progress: ${stats.processed}/${stats.total} commits (${stats.percentComplete}%)
      - Remaining: ${stats.remaining} commits
      - Output file: ${state.outputFile}
    `.trim()
  }

  private static calculateProgressStats(state: ProgressState): {
    processed: number
    total: number
    remaining: number
    percentComplete: number
  } {
    const processed = state.processedCommits.length
    const total = state.totalCommits.length
    const remaining = total - processed
    const percentComplete = calculatePercentage(processed, total)

    return { processed, total, remaining, percentComplete }
  }
}

