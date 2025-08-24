#!/usr/bin/env node

import { CSVService } from "./csv"
import { ProgressTracker } from "./progress"
import { GitError, handleError, ValidationError } from "./errors"

import { InputCsvHandler } from "./input-csv-handler"
import { ModelSelector } from "./model-selector"
import { CommitProcessor } from "./commit-processor"
import { SessionManager } from "./session-manager"
import { ReportHandler } from "./report-handler"
import { GitService } from "./git"
import { getCliOptions } from "./get-cli-options"
import { AnalyzedCommit } from "./types"
import { ConsoleUtils } from "./console-utils"

async function main(): Promise<void> {
  try {
    if (!GitService.isGitRepository()) {
      throw new GitError("Current directory is not a git repository")
    }

    const options = getCliOptions()

    if (options.inputCsv) {
      await InputCsvHandler.handleInputCsvMode(options)
      return
    }

    await ModelSelector.selectLLMModel(options)

    if (SessionManager.handleClearFlag(options)) {
      return
    }

    const {
      commitsToAnalyze: initialCommitsToAnalyze,
      analyzedCommits: initialAnalyzedCommits,
      processedCommits,
    } = await SessionManager.handleResumeMode(options)

    let commitsToAnalyze = initialCommitsToAnalyze
    let analyzedCommits = initialAnalyzedCommits

    commitsToAnalyze = SessionManager.getCommitsToAnalyze(
      options,
      commitsToAnalyze,
    )

    const allCommitsToAnalyze = [...processedCommits, ...commitsToAnalyze]

    const result = await CommitProcessor.processCommits({
      commitsToAnalyze,
      processedCommits,
      analyzedCommits,
      allCommitsToAnalyze,
      options,
    })
    analyzedCommits = result.analyzedCommits
    const failedCommits = result.failedCommits

    if (analyzedCommits.length === 0) {
      throw new ValidationError("No commits were successfully analyzed")
    }

    CSVService.exportToFile(analyzedCommits, options.output!)
    ConsoleUtils.logSection(`Analysis complete! Results exported to ${options.output}`)
    ConsoleUtils.logSuccess(
      `Successfully analyzed ${analyzedCommits.length}/${allCommitsToAnalyze.length} commits`,
    )

    if (failedCommits > 0) {
      ConsoleUtils.logWarning(
        `Failed to analyze ${failedCommits} commits (see errors above)`,
      )
    }

    // Generate report if --report flag is provided
    await ReportHandler.generateReportIfRequested(options)

    // Clear checkpoint on successful completion
    ProgressTracker.clearProgress()
    ConsoleUtils.logSuccess("Progress checkpoint cleared (analysis complete)")

    displayAnalysisSummary(analyzedCommits)
  } catch (error) {
    handleError(error)
  }
}

function displayAnalysisSummary(analyzedCommits: AnalyzedCommit[]): void {
  const summary = analyzedCommits.reduce(
    (acc, commit) => {
      acc[commit.analysis.category] = (acc[commit.analysis.category] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  ConsoleUtils.logSection("Summary by category:")
  Object.entries(summary).forEach(([category, count]) => {
    ConsoleUtils.logInfo(`${category}: ${count} commits`)
  })
}

if (require.main === module) {
  main()
}
