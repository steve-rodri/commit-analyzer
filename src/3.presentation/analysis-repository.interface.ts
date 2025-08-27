import { Analysis } from "@domain/analysis"
import { Commit } from "@domain/commit"

/**
 * Repository interface for commit analysis operations
 */
export interface IAnalysisRepository {
  /**
   * Analyzes a commit and returns the analysis result
   */
  analyze(commit: Commit): Promise<Analysis>

  /**
   * Checks if the analysis service is available
   */
  isAvailable(): Promise<boolean>

  /**
   * Gets the maximum number of retry attempts for analysis
   */
  getMaxRetries(): number

  /**
   * Sets verbose mode for detailed error information
   */
  setVerbose(verbose: boolean): void
}
