import { AnalyzedCommit } from "@domain/analyzed-commit"
import { CommitHash } from "@domain/commit-hash"

/**
 * Progress state for tracking analysis progress
 */
export interface ProgressState {
  totalCommits: CommitHash[]
  processedCommits: CommitHash[]
  analyzedCommits: AnalyzedCommit[]
  lastProcessedIndex: number
  startTime: Date
  outputFile: string
}

/**
 * Repository interface for progress tracking operations
 */
export interface IProgressRepository {
  /**
   * Saves the current progress state
   */
  saveProgress(state: ProgressState): Promise<void>

  /**
   * Loads the saved progress state
   */
  loadProgress(): Promise<ProgressState | null>

  /**
   * Checks if there is saved progress
   */
  hasProgress(): Promise<boolean>

  /**
   * Clears any saved progress
   */
  clearProgress(): Promise<void>

  /**
   * Gets the remaining commits from a progress state
   */
  getRemainingCommits(state: ProgressState): CommitHash[]

  /**
   * Formats a progress summary for display
   */
  formatProgressSummary(state: ProgressState): string
}
