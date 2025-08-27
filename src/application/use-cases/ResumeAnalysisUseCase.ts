import { ICommandHandler } from '../ports/in/ICommandHandler'
import { IProgressRepository } from '../../domain/repositories/IProgressRepository'
import { AnalyzeCommitsUseCase, AnalyzeCommitsResult } from './AnalyzeCommitsUseCase'
import { ConsoleFormatter } from '../../presentation/cli/formatters/ConsoleFormatter'

/**
 * Command for resuming analysis from checkpoint
 */
export interface ResumeAnalysisCommand {
  verbose?: boolean
}

/**
 * Use case for resuming analysis from a saved checkpoint
 */
export class ResumeAnalysisUseCase implements ICommandHandler<ResumeAnalysisCommand, AnalyzeCommitsResult | null> {
  constructor(
    private readonly progressRepository: IProgressRepository,
    private readonly analyzeCommitsUseCase: AnalyzeCommitsUseCase,
  ) {}

  async handle(command: ResumeAnalysisCommand): Promise<AnalyzeCommitsResult | null> {
    const { verbose = false } = command

    // Check if there's saved progress
    const hasProgress = await this.progressRepository.hasProgress()
    if (!hasProgress) {
      ConsoleFormatter.logInfo('No previous checkpoint found. Starting fresh...')
      return null
    }

    // Load progress state
    const progressState = await this.progressRepository.loadProgress()
    if (!progressState) {
      ConsoleFormatter.logError('Failed to load progress state.')
      return null
    }

    ConsoleFormatter.logInfo('Found previous session checkpoint')
    ConsoleFormatter.logInfo(this.progressRepository.formatProgressSummary(progressState))

    // Ask user if they want to resume
    const shouldResume = await this.promptUserForResume()
    if (!shouldResume) {
      await this.progressRepository.clearProgress()
      ConsoleFormatter.logInfo('Starting fresh analysis...')
      return null
    }

    // Get remaining commits
    const remainingCommits = this.progressRepository.getRemainingCommits(progressState)
    
    if (remainingCommits.length === 0) {
      ConsoleFormatter.logSuccess('All commits have already been processed!')
      await this.progressRepository.clearProgress()
      return {
        analyzedCommits: progressState.analyzedCommits,
        failedCommits: 0,
        totalProcessed: progressState.processedCommits.length,
      }
    }

    ConsoleFormatter.logInfo(`Resuming with ${remainingCommits.length} remaining commits...`)
    ConsoleFormatter.logInfo(`Previous progress: ${progressState.processedCommits.length}/${progressState.totalCommits.length} commits processed`)

    if (verbose) {
      ConsoleFormatter.logDebug(`analyzedCommits.length = ${progressState.analyzedCommits.length}`)
      ConsoleFormatter.logDebug(`processedCommits.length = ${progressState.processedCommits.length}`)
      ConsoleFormatter.logDebug(`remainingCommits.length = ${remainingCommits.length}`)
    }

    // Continue analysis with remaining commits
    const remainingHashStrings = remainingCommits.map(hash => hash.getValue())
    const result = await this.analyzeCommitsUseCase.handle({
      commitHashes: remainingHashStrings,
      outputFile: progressState.outputFile,
      verbose,
    })

    // Combine with previous results
    const totalAnalyzedCommits = [...progressState.analyzedCommits, ...result.analyzedCommits]
    
    return {
      analyzedCommits: totalAnalyzedCommits,
      failedCommits: result.failedCommits,
      totalProcessed: progressState.processedCommits.length + result.totalProcessed,
    }
  }

  private async promptUserForResume(): Promise<boolean> {
    // This would typically use a presentation layer service
    // For now, we'll return true to auto-resume
    // In a real implementation, this would prompt the user
    return true
  }
}