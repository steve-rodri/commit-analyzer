import { CacheService } from "@infra/cache-service"

import { AnalyzeCommand, AnalyzeCommandOptions } from "./analyze-command"
import { ICommitRepository } from "./commit-repository.interface"
import { ConsoleFormatter } from "./console-formatter"
import { IProgressRepository } from "./progress-repository.interface"
import { ReportCommand, ReportCommandOptions } from "./report-command"
import { ResumeCommand, ResumeCommandOptions } from "./resume-command"

export class CommitAnalysisController {
  constructor(
    private readonly analyzeCommand: AnalyzeCommand,
    private readonly reportCommand: ReportCommand,
    private readonly resumeCommand: ResumeCommand,
    private readonly progressRepository: IProgressRepository,
    private readonly cacheService: CacheService,
    private readonly commitRepository: ICommitRepository,
  ) {}

  /**
   * Handles the main analysis workflow
   */
  async handleAnalysis(options: AnalyzeCommandOptions): Promise<void> {
    await this.analyzeCommand.execute(options)
  }

  /**
   * Handles report generation
   */
  async handleReportGeneration(options: ReportCommandOptions): Promise<void> {
    await this.reportCommand.execute(options)
  }

  /**
   * Handles resuming analysis from checkpoint
   */
  async handleResumeAnalysis(options: ResumeCommandOptions): Promise<boolean> {
    return this.resumeCommand.execute(options)
  }

  /**
   * Handles the combined analysis and report workflow
   */
  async handleAnalysisWithReport(
    analyzeOptions: AnalyzeCommandOptions,
    reportOptions: ReportCommandOptions,
  ): Promise<void> {
    // First run analysis
    await this.handleAnalysis(analyzeOptions)

    // Resolve source info with actual user email if needed
    const resolvedSourceInfo = await this.resolveSourceInfo(
      reportOptions.sourceInfo,
      analyzeOptions.author,
    )

    // Then generate report using the analysis output
    const reportOptionsWithInput: ReportCommandOptions = {
      ...reportOptions,
      inputCsv: analyzeOptions.output,
      sourceInfo: resolvedSourceInfo,
    }

    await this.handleReportGeneration(reportOptionsWithInput)
  }

  /**
   * Handles clearing progress and cache
   */
  async handleClearProgress(): Promise<void> {
    await this.progressRepository.clearProgress()
    await this.cacheService.clear()
    ConsoleFormatter.logSuccess("✓ Progress checkpoint and cache cleared")
  }

  /**
   * Resolves source info with actual user email when needed
   */
  private async resolveSourceInfo(
    sourceInfo?: { type: "author" | "commits" | "csv"; value: string },
    authorOption?: string,
  ): Promise<
    { type: "author" | "commits" | "csv"; value: string } | undefined
  > {
    if (!sourceInfo) {
      return undefined
    }

    // If source is author and value is 'current user', get actual email
    if (sourceInfo.type === "author" && sourceInfo.value === "current user") {
      const actualEmail =
        authorOption || (await this.commitRepository.getCurrentUserEmail())
      return {
        type: "author",
        value: actualEmail,
      }
    }

    return sourceInfo
  }
}
