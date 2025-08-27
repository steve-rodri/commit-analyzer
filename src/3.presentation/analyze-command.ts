import { AnalyzedCommit } from "@domain/analyzed-commit"
import { CommitAnalysisService } from "@domain/commit-analysis-service"

import {
  AnalyzeCommitsResult,
  AnalyzeCommitsUseCase,
} from "@app/analyze-commits.usecase"

import { getErrorMessage } from "../utils"

import { ICommitRepository } from "./commit-repository.interface"
import { ConsoleFormatter } from "./console-formatter"

export interface AnalyzeCommandOptions {
  commits: string[]
  output: string
  author?: string
  limit?: number
  verbose?: boolean
}

export class AnalyzeCommand {
  constructor(
    private readonly analyzeCommitsUseCase: AnalyzeCommitsUseCase,
    private readonly commitAnalysisService: CommitAnalysisService,
    private readonly commitRepository: ICommitRepository,
  ) {}

  async execute(options: AnalyzeCommandOptions): Promise<void> {
    try {
      const commitHashes = await this.resolveCommitHashes(options)
      const analysisResult = await this.performAnalysis(commitHashes, options)
      this.displayResults(analysisResult, options.output)
    } catch (error) {
      ConsoleFormatter.logError(getErrorMessage(error))
      throw error
    }
  }

  private async resolveCommitHashes(
    options: AnalyzeCommandOptions,
  ): Promise<string[]> {
    if (options.commits.length > 0) {
      return options.commits
    }
    const { userEmail, userCommits } = await this.fetchUserCommits(options)
    const commitHashes = userCommits.map((commit) =>
      commit.getHash().getValue(),
    )
    if (commitHashes.length === 0) {
      ConsoleFormatter.logWarning(`No commits found for user: ${userEmail}`)
      throw new Error("No commits found for analysis")
    }
    ConsoleFormatter.logInfo(
      `Found ${commitHashes.length} commits for user: ${userEmail}`,
    )
    return commitHashes
  }

  private async fetchUserCommits(options: AnalyzeCommandOptions) {
    if (options.author) {
      const userCommits = await this.commitRepository.getByAuthor(
        options.author,
        options.limit,
      )
      return { userEmail: options.author, userCommits }
    }
    const userEmail = await this.commitRepository.getCurrentUserEmail()
    const userCommits = await this.commitAnalysisService.getCurrentUserCommits(
      options.limit,
    )
    return { userEmail, userCommits }
  }

  private async performAnalysis(
    commitHashes: string[],
    options: AnalyzeCommandOptions,
  ): Promise<AnalyzeCommitsResult> {
    if (commitHashes.length === 0) {
      throw new Error("No commits provided for analysis")
    }
    return await this.analyzeCommitsUseCase.handle({
      commitHashes,
      outputFile: options.output,
      verbose: options.verbose,
    })
  }

  private displayResults(
    result: AnalyzeCommitsResult,
    outputFile: string,
  ): void {
    ConsoleFormatter.logSection(
      `Analysis complete! Results exported to ${outputFile}`,
    )
    ConsoleFormatter.logSuccess(
      `Successfully analyzed ${result.analyzedCommits.length}/${result.totalProcessed} commits`,
    )
    if (result.failedCommits > 0) {
      ConsoleFormatter.logWarning(
        `Failed to analyze ${result.failedCommits} commits (see errors above)`,
      )
    }
    const summary = this.createAnalysisSummary(result.analyzedCommits)
    ConsoleFormatter.displayAnalysisSummary(summary)
  }

  private createAnalysisSummary(
    analyzedCommits: AnalyzedCommit[],
  ): Record<string, number> {
    return analyzedCommits.reduce(
      (summary, commit) => {
        const category = commit.getAnalysis().getCategory().getValue()
        summary[category] = (summary[category] || 0) + 1
        return summary
      },
      {} as Record<string, number>,
    )
  }
}
