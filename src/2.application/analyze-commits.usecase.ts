import { AnalyzedCommit } from "@domain/analyzed-commit"
import { CommitAnalysisService } from "@domain/commit-analysis-service"
import { CommitHash } from "@domain/commit-hash"

import { ICommandHandler } from "@presentation/command-handler.interface"
import { ConsoleFormatter } from "@presentation/console-formatter"
import { IProgressRepository } from "@presentation/progress-repository.interface"
import { IStorageRepository } from "@presentation/storage-repository.interface"

import { ConcurrencyManager } from "../utils/concurrency"

export interface AnalyzeCommitsCommand {
  commitHashes: string[]
  outputFile: string
  verbose?: boolean
  saveProgressInterval?: number
  batchSize?: number
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
  private static readonly DEFAULT_BATCH_SIZE = 1
  private static readonly DEFAULT_MAX_CONCURRENCY = 3

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
      batchSize = AnalyzeCommitsUseCase.DEFAULT_BATCH_SIZE,
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

    ConsoleFormatter.logInfo(`Analyzing ${valid.length} commits...`)

    if (batchSize === 1) {
      // Sequential processing for batch size 1
      for (let i = 0; i < valid.length; i++) {
        const hash = valid[i]
        const currentIndex = i + 1

        if (verbose) {
          ConsoleFormatter.logInfo(
            `[${currentIndex}/${valid.length}] Processing: ${hash.getShortHash()}`,
          )
        } else {
          ConsoleFormatter.updateProgress(currentIndex, valid.length, `Processing commits`)
        }

        try {
          const analyzedCommit =
            await this.commitAnalysisService.analyzeCommit(hash)
          analyzedCommits.push(analyzedCommit)
          processedCommits.push(hash)

          const analysis = analyzedCommit.getAnalysis()
          
          if (verbose) {
            ConsoleFormatter.logSuccess(
              `✓ [${currentIndex}/${valid.length}] Analyzed as "${analysis.getCategory().getValue()}": ${analysis.getSummary()}`,
            )
          }

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
            if (verbose) {
              ConsoleFormatter.logInfo(
                `Progress saved (${currentIndex}/${valid.length})`,
              )
            }
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error"
          
          if (verbose) {
            ConsoleFormatter.logError(`❌ [${currentIndex}/${valid.length}] Failed: ${errorMessage}`)
          }
          
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
      
      if (!verbose) {
        ConsoleFormatter.completeProgress()
      }
    } else {
      // Batch processing for batch size > 1
      const results = await this.processBatches(
        valid,
        batchSize,
        saveProgressInterval,
        hashes,
        outputFile,
        verbose
      )
      
      analyzedCommits.push(...results.analyzedCommits)
      processedCommits.push(...results.processedCommits)
      failedCommits = results.failedCommits
    }

    // Export results
    if (analyzedCommits.length > 0) {
      await this.storageRepository.exportToCSV(analyzedCommits, outputFile)
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

  private async processBatches(
    commitHashes: CommitHash[],
    batchSize: number,
    saveProgressInterval: number,
    allHashes: CommitHash[],
    outputFile: string,
    verbose: boolean
  ): Promise<{
    analyzedCommits: AnalyzedCommit[]
    processedCommits: CommitHash[]
    failedCommits: number
  }> {
    const analyzedCommits: AnalyzedCommit[] = []
    const processedCommits: CommitHash[] = []
    let failedCommits = 0

    // Process commits in batches
    for (let i = 0; i < commitHashes.length; i += batchSize) {
      const batch = commitHashes.slice(i, i + batchSize)
      const batchStart = i + 1
      const batchEnd = Math.min(i + batchSize, commitHashes.length)
      
      if (verbose) {
        ConsoleFormatter.logInfo(
          `Processing batch ${batchStart}-${batchEnd}/${commitHashes.length} (${batch.length} commits)`,
        )
      } else {
        ConsoleFormatter.updateProgress(batchStart, commitHashes.length, `Processing batch ${batchStart}-${batchEnd}`)
      }

      // Process all commits in this batch with controlled concurrency
      const concurrencyManager = new ConcurrencyManager(AnalyzeCommitsUseCase.DEFAULT_MAX_CONCURRENCY)
      
      const batchPromises = batch.map(async (hash, index) => {
        const globalIndex = i + index + 1
        
        return concurrencyManager.execute(async () => {
          try {
            if (verbose) {
              ConsoleFormatter.logInfo(
                `  [${globalIndex}/${commitHashes.length}] Processing: ${hash.getShortHash()}`,
              )
            }
            
            const analyzedCommit = await this.commitAnalysisService.analyzeCommit(hash)
            const analysis = analyzedCommit.getAnalysis()
            
            if (verbose) {
              ConsoleFormatter.logSuccess(
                `✓ [${globalIndex}/${commitHashes.length}] Analyzed as "${analysis.getCategory().getValue()}": ${analysis.getSummary()}`,
              )
            }
            
            return { success: true, commit: analyzedCommit, hash }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            
            if (verbose) {
              ConsoleFormatter.logError(`❌ [${globalIndex}/${commitHashes.length}] Failed: ${errorMessage}`)
              ConsoleFormatter.logError(`    Detailed error: ${errorMessage}`)
            }
            
            return { success: false, hash, error: errorMessage }
          }
        })
      })

      // Wait for all commits in this batch to complete
      const batchResults = await Promise.all(batchPromises)
      
      // Process results
      for (const result of batchResults) {
        processedCommits.push(result.hash)
        
        if (result.success && 'commit' in result && result.commit) {
          analyzedCommits.push(result.commit)
        } else {
          failedCommits++
        }
      }

      // Save progress periodically or after each batch
      if (
        (i + batchSize) % (saveProgressInterval * batchSize) === 0 ||
        (i + batchSize) >= commitHashes.length
      ) {
        await this.saveProgress(
          allHashes,
          processedCommits,
          analyzedCommits,
          outputFile,
        )
        if (verbose) {
          ConsoleFormatter.logInfo(
            `Progress saved (${processedCommits.length}/${commitHashes.length})`,
          )
        }
      }
    }

    if (!verbose) {
      ConsoleFormatter.completeProgress()
    }

    return {
      analyzedCommits,
      processedCommits,
      failedCommits
    }
  }
}
