import { ICommandHandler } from '../ports/in/ICommandHandler'
import { CommitAnalysisService } from '../../domain/services/CommitAnalysisService'
import { IProgressRepository } from '../../domain/repositories/IProgressRepository'
import { IStorageRepository } from '../../domain/repositories/IStorageRepository'
import { AnalyzedCommit } from '../../domain/entities/AnalyzedCommit'
import { CommitHash } from '../../domain/value-objects/CommitHash'
import { ConsoleFormatter } from '../../presentation/cli/formatters/ConsoleFormatter'

/**
 * Command for analyzing commits
 */
export interface AnalyzeCommitsCommand {
  commitHashes: string[]
  outputFile: string
  verbose?: boolean
  saveProgressInterval?: number
}

/**
 * Result of commit analysis
 */
export interface AnalyzeCommitsResult {
  analyzedCommits: AnalyzedCommit[]
  failedCommits: number
  totalProcessed: number
}

/**
 * Use case for analyzing Git commits
 */
export class AnalyzeCommitsUseCase implements ICommandHandler<AnalyzeCommitsCommand, AnalyzeCommitsResult> {
  private static readonly DEFAULT_PROGRESS_INTERVAL = 10

  constructor(
    private readonly commitAnalysisService: CommitAnalysisService,
    private readonly progressRepository: IProgressRepository,
    private readonly storageRepository: IStorageRepository,
  ) {}

  async handle(command: AnalyzeCommitsCommand): Promise<AnalyzeCommitsResult> {
    const { commitHashes, outputFile, verbose = false, saveProgressInterval = AnalyzeCommitsUseCase.DEFAULT_PROGRESS_INTERVAL } = command

    if (commitHashes.length === 0) {
      throw new Error('No commits provided for analysis')
    }

    // Convert string hashes to domain objects
    const hashes = commitHashes.map(hash => CommitHash.create(hash))

    // Validate commits exist
    const { valid, invalid } = await this.commitAnalysisService.validateCommits(hashes)
    
    if (invalid.length > 0) {
      ConsoleFormatter.logWarning(`Warning: ${invalid.length} invalid commit hashes found`)
      for (const invalidHash of invalid) {
        ConsoleFormatter.logWarning(`  - ${invalidHash.getShortHash()}`)
      }
    }

    if (valid.length === 0) {
      throw new Error('No valid commits found for analysis')
    }

    const analyzedCommits: AnalyzedCommit[] = []
    const processedCommits: CommitHash[] = []
    let failedCommits = 0

    ConsoleFormatter.logInfo(`\nAnalyzing ${valid.length} commits...`)

    for (let i = 0; i < valid.length; i++) {
      const hash = valid[i]
      const currentIndex = i + 1

      ConsoleFormatter.logInfo(`\n[${currentIndex}/${valid.length}] Processing commit: ${hash.getShortHash()}`)

      try {
        const analyzedCommit = await this.commitAnalysisService.analyzeCommit(hash)
        analyzedCommits.push(analyzedCommit)
        processedCommits.push(hash)

        const analysis = analyzedCommit.getAnalysis()
        ConsoleFormatter.logSuccess(`  Analyzed as "${analysis.getCategory().getValue()}": ${analysis.getSummary()}`)

        // Save progress periodically
        if (currentIndex % saveProgressInterval === 0 || currentIndex === valid.length) {
          await this.saveProgress(hashes, processedCommits, analyzedCommits, outputFile)
          ConsoleFormatter.logInfo(`  Progress saved (${currentIndex}/${valid.length})`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        ConsoleFormatter.logError(`  Failed: ${errorMessage}`)
        failedCommits++
        processedCommits.push(hash)

        // Save progress on failure
        await this.saveProgress(hashes, processedCommits, analyzedCommits, outputFile)

        if (verbose) {
          ConsoleFormatter.logError(`    Detailed error: ${errorMessage}`)
        }
      }
    }

    // Export results
    if (analyzedCommits.length > 0) {
      await this.storageRepository.exportToCSV(analyzedCommits, outputFile)
      ConsoleFormatter.logSuccess(`\nAnalysis complete! Results exported to ${outputFile}`)
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