#!/usr/bin/env node

import { GitService } from "./git"
import { LLMService } from "./llm"
import { CSVService } from "./csv"
import { CLIService } from "./cli"
import { handleError, GitError, ValidationError } from "./errors"
import { AnalyzedCommit } from "./types"

async function main(): Promise<void> {
  try {
    if (!GitService.isGitRepository()) {
      throw new GitError("Current directory is not a git repository")
    }

    const options = CLIService.parseArguments()

    let commitsToAnalyze: string[] = options.commits

    if (options.useDefaults) {
      console.log("No commits specified, analyzing your authored commits...")
      const userEmail = GitService.getCurrentUserEmail()
      const userName = GitService.getCurrentUserName()
      console.log(`Finding commits by ${userName} (${userEmail})`)

      commitsToAnalyze = GitService.getUserAuthoredCommits(
        options.author,
        options.limit,
      )

      if (commitsToAnalyze.length === 0) {
        throw new ValidationError(
          "No commits found for the current user. Make sure you have commits in this repository.",
        )
      }

      const limitText = options.limit ? ` (limited to ${options.limit})` : ""
      console.log(`Found ${commitsToAnalyze.length} commits${limitText}`)
    }

    console.log(`Analyzing ${commitsToAnalyze.length} commits...`)

    const analyzedCommits: AnalyzedCommit[] = []

    for (const [index, hash] of commitsToAnalyze.entries()) {
      console.log(
        `Processing commit ${index + 1}/${commitsToAnalyze.length}: ${hash}`,
      )

      if (!GitService.validateCommitHash(hash)) {
        throw new ValidationError(`Invalid commit hash: ${hash}`)
      }

      try {
        const commitInfo = await GitService.getCommitInfo(hash)
        console.log(`  - Extracted commit info for ${hash.substring(0, 8)}`)

        const analysis = await LLMService.analyzeCommit(commitInfo)
        console.log(
          `  - Analyzed as "${analysis.category}": ${analysis.summary}`,
        )

        analyzedCommits.push({
          ...commitInfo,
          analysis,
        })
      } catch (error) {
        console.error(
          `  - Failed to process commit ${hash}: ${error instanceof Error ? error.message : "Unknown error"}`,
        )
        continue
      }
    }

    if (analyzedCommits.length === 0) {
      throw new ValidationError("No commits were successfully analyzed")
    }

    CSVService.exportToFile(analyzedCommits, options.output!)
    console.log(`\nAnalysis complete! Results exported to ${options.output}`)
    console.log(
      `Successfully analyzed ${analyzedCommits.length}/${commitsToAnalyze.length} commits`,
    )

    const summary = analyzedCommits.reduce(
      (acc, commit) => {
        acc[commit.analysis.category] = (acc[commit.analysis.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    console.log("\nSummary by category:")
    Object.entries(summary).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} commits`)
    })
  } catch (error) {
    handleError(error)
  }
}

if (require.main === module) {
  main()
}

