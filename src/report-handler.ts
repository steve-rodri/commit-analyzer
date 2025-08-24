import { CLIService, CLIOptions } from "./cli"
import { MarkdownReportGenerator } from "./report-generator"

export class ReportHandler {
  static async generateReportIfRequested(options: CLIOptions): Promise<void> {
    if (!options.report) return

    console.log("\nGenerating condensed markdown report...")

    // Determine report output filename
    let reportOutput: string
    if (options.output!.endsWith(".csv")) {
      reportOutput = options.output!.replace(".csv", ".md")
    } else {
      reportOutput = options.output! + ".md"
    }

    // Handle default case - if output is commits.csv, make report report.md
    if (reportOutput.endsWith("commits.md")) {
      reportOutput = reportOutput.replace("commits.md", "report.md")
    }

    // If output directory is specified but report output is just a filename, use the output directory
    if (
      options.outputDir &&
      !reportOutput.includes("/") &&
      !reportOutput.includes("\\")
    ) {
      reportOutput = CLIService.resolveOutputPath(
        reportOutput.split("/").pop() || reportOutput,
        options.outputDir,
      )
    }

    try {
      await MarkdownReportGenerator.generateReport(
        options.output!,
        reportOutput,
      )
      console.log(`📊 Report generated: ${reportOutput}`)
    } catch (error) {
      console.error(
        `⚠️  Failed to generate report: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
      console.log(
        "CSV analysis was successful, but report generation failed.",
      )
    }
  }
}