import { CLIService, CLIOptions } from "./cli"
import { MarkdownReportGenerator } from "./report-generator"
import { ConsoleUtils } from "./console-utils"

export class ReportHandler {
  static async generateReportIfRequested(options: CLIOptions): Promise<void> {
    if (!options.report) return

    ConsoleUtils.logSection("Generating condensed markdown report...")

    const reportOutput = this.determineReportOutputPath(options)

    try {
      await MarkdownReportGenerator.generateReport(
        options.output!,
        reportOutput,
      )
      ConsoleUtils.logReport(`Report generated: ${reportOutput}`)
    } catch (error) {
      ConsoleUtils.logError(
        `Failed to generate report: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
      ConsoleUtils.logInfo(
        "CSV analysis was successful, but report generation failed.",
      )
    }
  }

  private static determineReportOutputPath(options: CLIOptions): string {
    // Convert CSV extension to MD
    let reportOutput = options.output!.endsWith(".csv")
      ? options.output!.replace(".csv", ".md")
      : options.output! + ".md"

    // Handle default case - commits.csv becomes report.md
    if (reportOutput.endsWith("commits.md")) {
      reportOutput = reportOutput.replace("commits.md", "report.md")
    }

    // Apply output directory if specified and path is relative
    return this.applyOutputDirectory(reportOutput, options.outputDir)
  }

  private static applyOutputDirectory(reportOutput: string, outputDir?: string): string {
    if (!outputDir) return reportOutput
    
    const isRelativePath = !reportOutput.includes("/") && !reportOutput.includes("\\")
    if (isRelativePath) {
      return CLIService.resolveOutputPath(
        reportOutput.split("/").pop() || reportOutput,
        outputDir,
      )
    }
    
    return reportOutput
  }
}