import * as readline from "readline"
import { GitService } from "./git"
import { ProgressTracker } from "./progress"
import { ValidationError } from "./errors"
import { CLIOptions } from "./cli"
import { AnalyzedCommit } from "./types"
import { ConsoleUtils } from "./console-utils"

export class SessionManager {
  static async promptResume(): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question(
        "\nDo you want to resume from the checkpoint? (y/n): ",
        (answer) => {
          rl.close()
          resolve(
            answer.toLowerCase() === "y" || answer.toLowerCase() === "yes",
          )
        },
      )
    })
  }

  static async handleResumeMode(options: CLIOptions): Promise<{
    commitsToAnalyze: string[]
    analyzedCommits: AnalyzedCommit[]
    processedCommits: string[]
  }> {
    let commitsToAnalyze: string[] = options.commits
    let analyzedCommits: AnalyzedCommit[] = []
    let processedCommits: string[] = []

    if (options.resume && ProgressTracker.hasProgress()) {
      const progressState = ProgressTracker.loadProgress()
      if (progressState) {
        ConsoleUtils.logFile("Found previous session checkpoint")
        console.log(ProgressTracker.formatProgressSummary(progressState))

        const resumeChoice = await this.promptResume()
        if (resumeChoice) {
          commitsToAnalyze = ProgressTracker.getRemainingCommits(progressState)
          analyzedCommits = progressState.analyzedCommits
          processedCommits = progressState.processedCommits

          // Use the output file from the previous session
          options.output = progressState.outputFile

          ConsoleUtils.logProgress(
            `Resuming with ${commitsToAnalyze.length} remaining commits...`,
          )
          ConsoleUtils.logReport(
            `Previous progress: ${processedCommits.length}/${progressState.totalCommits.length} commits processed`,
          )
          if (options.verbose) {
            ConsoleUtils.logIndented(
              `Debug: analyzedCommits.length = ${analyzedCommits.length}`,
              2,
            )
            ConsoleUtils.logIndented(
              `Debug: processedCommits.length = ${processedCommits.length}`,
              2,
            )
            ConsoleUtils.logIndented(
              `Debug: commitsToAnalyze.length = ${commitsToAnalyze.length}`,
              2,
            )
          }
        } else {
          ProgressTracker.clearProgress()
          ConsoleUtils.logInfo("Starting fresh analysis...")
        }
      }
    } else if (options.resume && !ProgressTracker.hasProgress()) {
      ConsoleUtils.logInfo("No previous checkpoint found. Starting fresh...")
    }

    return { commitsToAnalyze, analyzedCommits, processedCommits }
  }

  static handleClearFlag(options: CLIOptions): boolean {
    if (!options.clear) return false
    if (ProgressTracker.hasProgress()) {
      ProgressTracker.clearProgress()
      ConsoleUtils.logSuccess("Progress checkpoint cleared")
    } else {
      ConsoleUtils.logInfo("No progress checkpoint to clear")
    }
    return !options.resume
  }

  static getCommitsToAnalyze(
    options: CLIOptions,
    commitsToAnalyze: string[],
  ): string[] {
    const shouldGetNewCommits = this.shouldGetNewCommits(options, commitsToAnalyze)
    
    if (shouldGetNewCommits && options.useDefaults) {
      return this.getUserAuthoredCommitsWithLogging(options)
    }
    
    return commitsToAnalyze
  }

  private static shouldGetNewCommits(
    options: CLIOptions,
    commitsToAnalyze: string[],
  ): boolean {
    return commitsToAnalyze.length === 0 || (!options.resume && !options.clear)
  }

  private static getUserAuthoredCommitsWithLogging(options: CLIOptions): string[] {
    ConsoleUtils.logInfo("No commits specified, analyzing your authored commits...")
    const userEmail = GitService.getCurrentUserEmail()
    const userName = GitService.getCurrentUserName()
    ConsoleUtils.logInfo(`Finding commits by ${userName} (${userEmail})`)

    const commits = GitService.getUserAuthoredCommits(options.author, options.limit)

    if (commits.length === 0) {
      throw new ValidationError(
        "No commits found for the current user. Make sure you have commits in this repository.",
      )
    }

    const limitText = options.limit ? ` (limited to ${options.limit})` : ""
    ConsoleUtils.logSuccess(`Found ${commits.length} commits${limitText}`)
    
    return commits
  }
}
