import { GitService } from "./git"
import { LLMService } from "./llm"
import { CSVService } from "./csv"
import { ProgressTracker } from "./progress"
import { CLIOptions } from "./cli"
import { AnalyzedCommit } from "./types"

export class CommitProcessor {
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

        // Save progress every 10 commits or on failure
        if (overallIndex % 10 === 0 || index === commitsToAnalyze.length - 1) {
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
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        console.error(`  ❌ Failed: ${errorMessage}`)
        failedCommits++
        processedCommits.push(hash)

        // Check if this was a rate limit error and provide helpful messaging
        const isRateLimitError =
          errorMessage.includes("quota exceeded") ||
          errorMessage.includes("rate limit") ||
          errorMessage.includes("429")

        // Save progress on failure
        ProgressTracker.saveProgress(
          allCommitsToAnalyze,
          processedCommits,
          analyzedCommits,
          options.output!,
        )
        console.log(`  💾 Progress saved after failure`)

        // Provide specific guidance based on error type
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

        console.log(
          `✅ Successfully analyzed ${analyzedCommits.length} commits before failure`,
        )
        console.log(
          `📁 Progress saved. Use --resume to continue from commit ${overallIndex + 1}`,
        )

        // Export what we have so far
        if (analyzedCommits.length > 0) {
          CSVService.exportToFile(analyzedCommits, options.output!)
          console.log(`📊 Partial results exported to ${options.output}`)
        }

        process.exit(1)
      }
    }

    return { analyzedCommits, failedCommits }
  }
}

