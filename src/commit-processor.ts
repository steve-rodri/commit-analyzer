import { GitService } from "./git"
import { LLMService } from "./llm"
import { CSVService } from "./csv"
import { ProgressTracker } from "./progress"
import { CLIOptions } from "./cli"
import { AnalyzedCommit } from "./types"

export class CommitProcessor {
  private static readonly PROGRESS_SAVE_INTERVAL = 10
  private static readonly RETRY_COUNT_MESSAGE_THRESHOLD = 3

  static async processCommits({
    commitsToAnalyze,
    processedCommits,
    analyzedCommits,
    allCommitsToAnalyze,
    options,
  }: {
    commitsToAnalyze: string[]
    processedCommits: string[]
    analyzedCommits: AnalyzedCommit[]
    allCommitsToAnalyze: string[]
    options: CLIOptions
  }): Promise<{ analyzedCommits: AnalyzedCommit[]; failedCommits: number }> {
    const totalCommitsToProcess =
      processedCommits.length + commitsToAnalyze.length
    console.log(
      `\nAnalyzing ${commitsToAnalyze.length} commits (${totalCommitsToProcess} total)...`,
    )

    let failedCommits = 0

    for (const [index, hash] of commitsToAnalyze.entries()) {
      const overallIndex = processedCommits.length + index + 1
      console.log(
        `\n[${overallIndex}/${totalCommitsToProcess}] Processing commit: ${hash.substring(0, 8)}`,
      )

      if (!GitService.validateCommitHash(hash)) {
        console.error(`  ❌ Invalid commit hash: ${hash}`)
        failedCommits++
        processedCommits.push(hash)
        continue
      }

      try {
        const commitInfo = await GitService.getCommitInfo(hash)
        console.log(`  ✓ Extracted commit info`)

        const analysis = await LLMService.analyzeCommit(commitInfo)
        console.log(
          `  ✓ Analyzed as "${analysis.category}": ${analysis.summary}`,
        )

        analyzedCommits.push({
          ...commitInfo,
          analysis,
        })

        processedCommits.push(hash)

        // Save progress every N commits or on final commit
        if (overallIndex % this.PROGRESS_SAVE_INTERVAL === 0 || index === commitsToAnalyze.length - 1) {
          ProgressTracker.saveProgress(
            allCommitsToAnalyze,
            processedCommits,
            analyzedCommits,
            options.output!,
          )
          console.log(
            `  💾 Progress saved (${overallIndex}/${totalCommitsToProcess})`,
          )
          if (options.verbose) {
            console.log(
              `     Debug: Saved ${processedCommits.length} processed, ${analyzedCommits.length} analyzed`,
            )
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        console.error(`  ❌ Failed: ${errorMessage}`)
        failedCommits++
        processedCommits.push(hash)

        await this.handleProcessingError(
          error,
          allCommitsToAnalyze,
          processedCommits,
          analyzedCommits,
          options,
          overallIndex,
        )
      }
    }

    return { analyzedCommits, failedCommits }
  }

  private static async handleProcessingError(
    error: unknown,
    allCommitsToAnalyze: string[],
    processedCommits: string[],
    analyzedCommits: AnalyzedCommit[],
    options: CLIOptions,
    overallIndex: number,
  ): Promise<never> {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const isRateLimitError = this.isRateLimitError(errorMessage)

    // Save progress on failure
    ProgressTracker.saveProgress(
      allCommitsToAnalyze,
      processedCommits,
      analyzedCommits,
      options.output!,
    )
    console.log(`  💾 Progress saved after failure`)

    this.displayErrorGuidance(isRateLimitError, analyzedCommits.length, overallIndex)
    
    // Export partial results if available
    if (analyzedCommits.length > 0) {
      CSVService.exportToFile(analyzedCommits, options.output!)
      console.log(`📊 Partial results exported to ${options.output}`)
    }

    process.exit(1)
  }

  private static isRateLimitError(errorMessage: string): boolean {
    return (
      errorMessage.includes("quota exceeded") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("429")
    )
  }

  private static displayErrorGuidance(
    isRateLimitError: boolean,
    analyzedCount: number,
    overallIndex: number,
  ): void {
    if (isRateLimitError) {
      console.error(`\n⛔ Stopping due to rate limit/quota exceeded`)
      console.log(`💡 Suggestions:`)
      console.log(
        `   • Wait for quota to reset (daily limits typically reset at midnight Pacific Time)`,
      )
      console.log(
        `   • Switch to a different model: --model claude or --model codex`,
      )
      console.log(`   • Resume later with: --resume`)
    } else {
      console.error(
        `\n⛔ Stopping due to failure (after ${LLMService.getMaxRetries()} retry attempts)`,
      )
      console.log(`💡 Suggestions:`)
      console.log(`   • Check your LLM model configuration and credentials`)
      console.log(
        `   • Run with --verbose flag for detailed error information`,
      )
      console.log(`   • Resume later with: --resume`)
    }

    console.log(`✅ Successfully analyzed ${analyzedCount} commits before failure`)
    console.log(`📁 Progress saved. Use --resume to continue from commit ${overallIndex + 1}`)
  }
}

