import { AnalyzeCommitsUseCase } from "../../../application/use-cases/AnalyzeCommitsUseCase"
import { ConsoleFormatter } from "../formatters/ConsoleFormatter"

/**
 * CLI command for analyzing commits
 */
export interface AnalyzeCommandOptions {
  commits: string[]
  output: string
  author?: string
  limit?: number
  verbose?: boolean
  file?: string
  useDefaults?: boolean
}

/**
 * Analyze command implementation
 */
export class AnalyzeCommand {
  constructor(private readonly analyzeCommitsUseCase: AnalyzeCommitsUseCase) {}

  async execute(options: AnalyzeCommandOptions): Promise<void> {
    try {
      let { commits } = options
      
      // Handle different sources of commits
      if (options.file) {
        commits = await this.readCommitsFromFile(options.file)
      } else if (commits.length === 0 && options.useDefaults) {
        // This would typically call a service to get user commits
        throw new Error("Default commit retrieval not implemented in command layer")
      }

      if (commits.length === 0) {
        throw new Error("No commits provided for analysis")
      }

      // Execute the use case
      const result = await this.analyzeCommitsUseCase.handle({
        commitHashes: commits,
        outputFile: options.output,
        verbose: options.verbose,
      })

      // Display results
      ConsoleFormatter.logSection(`Analysis complete! Results exported to ${options.output}`)
      ConsoleFormatter.logSuccess(
        `Successfully analyzed ${result.analyzedCommits.length}/${result.totalProcessed} commits`,
      )

      if (result.failedCommits > 0) {
        ConsoleFormatter.logWarning(
          `Failed to analyze ${result.failedCommits} commits (see errors above)`,
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

    } catch (error) {
      ConsoleFormatter.logError(
        error instanceof Error ? error.message : "Unknown error occurred"
      )
      throw error
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async readCommitsFromFile(_filePath: string): Promise<string[]> {
    // This would typically use a storage service
    // For now, return empty array as placeholder
    throw new Error("File reading not implemented in command layer")
  }
}