#!/usr/bin/env node

import { GitService } from "./git"
import { LLMService } from "./llm"
import { CSVService } from "./csv"
import { CLIService } from "./cli"
import { ProgressTracker } from "./progress"
import { handleError, GitError, ValidationError } from "./errors"
import { AnalyzedCommit } from "./types"
import * as readline from "readline"

async function promptResume(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question("\nDo you want to resume from the checkpoint? (y/n): ", (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes")
    })
  })
}

async function main(): Promise<void> {
  try {
    if (!GitService.isGitRepository()) {
      throw new GitError("Current directory is not a git repository")
    }

    const options = CLIService.parseArguments()

    // Handle clear flag
    if (options.clear) {
      if (ProgressTracker.hasProgress()) {
        ProgressTracker.clearProgress()
        console.log("✓ Progress checkpoint cleared")
      } else {
        console.log("No progress checkpoint to clear")
      }
      if (!options.resume) {
        return
      }
    }

    let commitsToAnalyze: string[] = options.commits
    let analyzedCommits: AnalyzedCommit[] = []
    let processedCommits: string[] = []

    // Handle resume flag
    if (options.resume && ProgressTracker.hasProgress()) {
      const progressState = ProgressTracker.loadProgress()
      if (progressState) {
        console.log("📂 Found previous session checkpoint")
        console.log(ProgressTracker.formatProgressSummary(progressState))
        
        const resumeChoice = await promptResume()
        if (resumeChoice) {
          commitsToAnalyze = ProgressTracker.getRemainingCommits(progressState)
          analyzedCommits = progressState.analyzedCommits
          processedCommits = progressState.processedCommits
          
          // Use the output file from the previous session
          options.output = progressState.outputFile
          
          console.log(`\n▶️  Resuming with ${commitsToAnalyze.length} remaining commits...`)
        } else {
          ProgressTracker.clearProgress()
          console.log("Starting fresh analysis...")
        }
      }
    } else if (options.resume && !ProgressTracker.hasProgress()) {
      console.log("No previous checkpoint found. Starting fresh...")
    }

    // Only get new commits if not resuming
    if (commitsToAnalyze.length === 0 || (!options.resume && !options.clear)) {
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
    }

    const totalCommitsToProcess = processedCommits.length + commitsToAnalyze.length
    console.log(`\nAnalyzing ${commitsToAnalyze.length} commits (${totalCommitsToProcess} total)...`)

    let failedCommits = 0

    // Keep track of all commits for checkpoint
    const allCommitsToAnalyze = [...processedCommits, ...commitsToAnalyze]
    
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
        if ((overallIndex % 10 === 0) || index === commitsToAnalyze.length - 1) {
          ProgressTracker.saveProgress(
            allCommitsToAnalyze,
            processedCommits,
            analyzedCommits,
            options.output!,
          )
          console.log(`  💾 Progress saved (${overallIndex}/${totalCommitsToProcess})`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        console.error(`  ❌ Failed: ${errorMessage}`)
        failedCommits++
        processedCommits.push(hash)
        
        // Save progress on failure
        ProgressTracker.saveProgress(
          allCommitsToAnalyze,
          processedCommits,
          analyzedCommits,
          options.output!,
        )
        console.log(`  💾 Progress saved after failure`)
        
        // Always stop on failure after max retries
        console.error(`\n⛔ Stopping due to failure (after ${LLMService.getMaxRetries()} retry attempts)`)
        console.log(`✅ Successfully analyzed ${analyzedCommits.length} commits before failure`)
        console.log(`📁 Progress saved. Use --resume to continue from commit ${overallIndex + 1}`)
        
        // Export what we have so far
        if (analyzedCommits.length > 0) {
          CSVService.exportToFile(analyzedCommits, options.output!)
          console.log(`📊 Partial results exported to ${options.output}`)
        }
        
        process.exit(1)
      }
    }

    if (analyzedCommits.length === 0) {
      throw new ValidationError("No commits were successfully analyzed")
    }

    CSVService.exportToFile(analyzedCommits, options.output!)
    console.log(`\n✅ Analysis complete! Results exported to ${options.output}`)
    console.log(
      `Successfully analyzed ${analyzedCommits.length}/${totalCommitsToProcess} commits`,
    )
    
    if (failedCommits > 0) {
      console.log(`⚠️  Failed to analyze ${failedCommits} commits (see errors above)`)
    }
    
    // Clear checkpoint on successful completion
    ProgressTracker.clearProgress()
    console.log("✓ Progress checkpoint cleared (analysis complete)")

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

