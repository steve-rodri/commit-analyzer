import { GenerateReportUseCase } from "../../../application/use-cases/GenerateReportUseCase"
import { ConsoleFormatter } from "../formatters/ConsoleFormatter"

/**
 * CLI command for generating reports
 */
export interface ReportCommandOptions {
  inputCsv?: string
  output: string
  includeStatistics?: boolean
}

/**
 * Report command implementation
 */
export class ReportCommand {
  constructor(private readonly generateReportUseCase: GenerateReportUseCase) {}

  async execute(options: ReportCommandOptions): Promise<void> {
    try {
      ConsoleFormatter.logInfo("Generating report from existing CSV...")

      const result = await this.generateReportUseCase.handle({
        inputCsvPath: options.inputCsv,
        outputPath: options.output,
        includeStatistics: options.includeStatistics ?? true,
      })

      ConsoleFormatter.logReport(`Report generated: ${result.reportPath}`)
      
      // Display statistics
      const stats = result.statistics
      ConsoleFormatter.logSuccess(
        `Processed ${result.commitsProcessed} commits spanning ${stats.yearRange.min}-${stats.yearRange.max}`
      )
      
      ConsoleFormatter.logInfo(
        `Categories: ${stats.categoryBreakdown.feature} features, ${stats.categoryBreakdown.process} process, ${stats.categoryBreakdown.tweak} tweaks`
      )

    } catch (error) {
      ConsoleFormatter.logError(
        error instanceof Error ? error.message : "Unknown error occurred"
      )
      throw error
    }
  }
}