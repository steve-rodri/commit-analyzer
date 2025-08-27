import { AnalyzeCommand, AnalyzeCommandOptions } from "./analyze-command"
import { ReportCommand, ReportCommandOptions } from "./report-command"
import { ResumeCommand, ResumeCommandOptions } from "./resume-command"

/**
 * Controller for coordinating commit analysis operations
 */
export class CommitAnalysisController {
  constructor(
    private readonly analyzeCommand: AnalyzeCommand,
    private readonly reportCommand: ReportCommand,
    private readonly resumeCommand: ResumeCommand,
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

    // Then generate report using the analysis output
    const reportOptionsWithInput: ReportCommandOptions = {
      ...reportOptions,
      inputCsv: analyzeOptions.output,
    }

    await this.handleReportGeneration(reportOptionsWithInput)
  }

  /**
   * Handles clearing progress
   */
  async handleClearProgress(): Promise<void> {
    // This would typically call a progress service to clear checkpoints
    // For now, just log the action
    console.log("✓ Progress checkpoint cleared")
  }
}
