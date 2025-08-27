import { AnalyzedCommit } from "@domain/analyzed-commit"
import { CommitAnalysisService } from "@domain/commit-analysis-service"
import { CommitHash } from "@domain/commit-hash"

import { ICommandHandler } from "@presentation/command-handler.interface"
import { ConsoleFormatter } from "@presentation/console-formatter"
import { IProgressRepository } from "@presentation/progress-repository.interface"
import { IStorageRepository } from "@presentation/storage-repository.interface"

export interface AnalyzeCommitsCommand {
  commitHashes: string[]
  outputFile: string
  verbose?: boolean
  saveProgressInterval?: number
}

export interface AnalyzeCommitsResult {
  analyzedCommits: AnalyzedCommit[]
  failedCommits: number
  totalProcessed: number
}

export class AnalyzeCommitsUseCase
  implements ICommandHandler<AnalyzeCommitsCommand, AnalyzeCommitsResult>
{
  private static readonly DEFAULT_PROGRESS_INTERVAL = 10

  constructor(
    private readonly commitAnalysisService: CommitAnalysisService,
    private readonly progressRepository: IProgressRepository,
    private readonly storageRepository: IStorageRepository,
  ) {}

  async handle(command: AnalyzeCommitsCommand): Promise<AnalyzeCommitsResult> {
    const {
      commitHashes,
      outputFile,
      verbose = false,
      saveProgressInterval = AnalyzeCommitsUseCase.DEFAULT_PROGRESS_INTERVAL,
    } = command

    if (commitHashes.length === 0) {
      throw new Error("No commits provided for analysis")
    }

    // Convert string hashes to domain objects
    const hashes = commitHashes.map((hash) => CommitHash.create(hash))

    // Validate commits exist
    const { valid, invalid } =
      await this.commitAnalysisService.validateCommits(hashes)

    if (invalid.length > 0) {
      ConsoleFormatter.logWarning(
        `Warning: ${invalid.length} invalid commit hashes found`,
      )
      for (const invalidHash of invalid) {
        ConsoleFormatter.logWarning(`  - ${invalidHash.getShortHash()}`)
      }
    }

    if (valid.length === 0) {
      throw new Error("No valid commits found for analysis")
    }

    const analyzedCommits: AnalyzedCommit[] = []
    const processedCommits: CommitHash[] = []
    let failedCommits = 0

    ConsoleFormatter.logInfo(`\nAnalyzing ${valid.length} commits...`)

    for (let i = 0; i < valid.length; i++) {
      const hash = valid[i]
      const currentIndex = i + 1

      ConsoleFormatter.logInfo(
        `\n[${currentIndex}/${valid.length}] Processing commit: ${hash.getShortHash()}`,
      )

      try {
        const analyzedCommit =
          await this.commitAnalysisService.analyzeCommit(hash)
        analyzedCommits.push(analyzedCommit)
        processedCommits.push(hash)

        const analysis = analyzedCommit.getAnalysis()
        ConsoleFormatter.logSuccess(
          `  Analyzed as "${analysis.getCategory().getValue()}": ${analysis.getSummary()}`,
        )

        // Save progress periodically
        if (
          currentIndex % saveProgressInterval === 0 ||
          currentIndex === valid.length
        ) {
          await this.saveProgress(
            hashes,
            processedCommits,
            analyzedCommits,
            outputFile,
          )
          ConsoleFormatter.logInfo(
            `  Progress saved (${currentIndex}/${valid.length})`,
          )
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        ConsoleFormatter.logError(`  Failed: ${errorMessage}`)
        failedCommits++
        processedCommits.push(hash)

        // Save progress on failure
        await this.saveProgress(
          hashes,
          processedCommits,
          analyzedCommits,
          outputFile,
        )

        if (verbose) {
          ConsoleFormatter.logError(`    Detailed error: ${errorMessage}`)
        }
      }
    }

    // Export results
    if (analyzedCommits.length > 0) {
      await this.storageRepository.exportToCSV(analyzedCommits, outputFile)
      ConsoleFormatter.logSuccess(
        `\nAnalysis complete! Results exported to ${outputFile}`,
      )
    }

    return {
      analyzedCommits,
      failedCommits,
      totalProcessed: processedCommits.length,
    }
  }

  private async saveProgress(
    totalCommits: CommitHash[],
    processedCommits: CommitHash[],
    analyzedCommits: AnalyzedCommit[],
    outputFile: string,
  ): Promise<void> {
    const progressState = {
      totalCommits,
      processedCommits,
      analyzedCommits,
      lastProcessedIndex: processedCommits.length - 1,
      startTime: new Date(),
      outputFile,
    }

    await this.progressRepository.saveProgress(progressState)
  }
}
