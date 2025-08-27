import { GenerateReportUseCase } from "@app/generate-report.usecase"

import { ConsoleFormatter } from "./console-formatter"

export interface ReportCommandOptions {
  inputCsv?: string
  output: string
  includeStatistics?: boolean
  sourceInfo?: {
    type: "author" | "commits" | "csv"
    value: string
  }
}

export class ReportCommand {
  constructor(private readonly generateReportUseCase: GenerateReportUseCase) {}

  async execute(options: ReportCommandOptions): Promise<void> {
    try {
      console.log("\nGenerating report from existing CSV...")

      const result = await this.generateReportUseCase.handle({
        inputCsvPath: options.inputCsv,
        outputPath: options.output,
        includeStatistics: options.includeStatistics ?? true,
        sourceInfo:
          options.sourceInfo ||
          (options.inputCsv
            ? { type: "csv", value: options.inputCsv }
            : undefined),
      })

      ConsoleFormatter.logReport(`Report generated: ${result.reportPath}`)

      const stats = result.statistics
      ConsoleFormatter.logSuccess(
        `Processed ${result.commitsProcessed} commits`,
      )

      ConsoleFormatter.logInfo(
        `Categories: ${stats.categoryBreakdown.feature} features, ${stats.categoryBreakdown.process} process, ${stats.categoryBreakdown.tweak} tweaks`,
      )
    } catch (error) {
      ConsoleFormatter.logError(
        error instanceof Error ? error.message : "Unknown error occurred",
      )
      throw error
    }
  }
}
