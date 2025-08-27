import { ResumeAnalysisUseCase } from "../../../application/use-cases/ResumeAnalysisUseCase"
import { ConsoleFormatter } from "../formatters/ConsoleFormatter"

/**
 * CLI command for resuming analysis
 */
export interface ResumeCommandOptions {
  verbose?: boolean
}

/**
 * Resume command implementation
 */
export class ResumeCommand {
  constructor(private readonly resumeAnalysisUseCase: ResumeAnalysisUseCase) {}

  async execute(options: ResumeCommandOptions): Promise<boolean> {
    try {
      const result = await this.resumeAnalysisUseCase.handle({
        verbose: options.verbose,
      })

      if (!result) {
        ConsoleFormatter.logInfo("No previous checkpoint found or user chose to start fresh")
        return false
      }

      // Display results
      ConsoleFormatter.logSuccess("Analysis resumed and completed successfully!")
      ConsoleFormatter.logInfo(
        `Total analyzed: ${result.analyzedCommits.length} commits`
      )

      if (result.failedCommits > 0) {
        ConsoleFormatter.logWarning(
          `Failed commits during resume: ${result.failedCommits}`
        )
      }

      // Display category summary
      const summary = result.analyzedCommits.reduce(
        (acc, commit) => {
          const category = commit.getAnalysis().getCategory().getValue()
          acc[category] = (acc[category] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )

      ConsoleFormatter.displayAnalysisSummary(summary)

      return true

    } catch (error) {
      ConsoleFormatter.logError(
        error instanceof Error ? error.message : "Unknown error occurred"
      )
      throw error
    }
  }
}