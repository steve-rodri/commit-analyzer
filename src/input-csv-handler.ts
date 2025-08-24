import { CLIService, CLIOptions } from "./cli"
import { MarkdownReportGenerator } from "./report-generator"

export class InputCsvHandler {
  static async handleInputCsvMode(options: CLIOptions): Promise<void> {
    console.log("Generating report from existing CSV...")
    setReportFlagTrue(options)
    const reportOutput = getOutputNameForReport(options)
    await MarkdownReportGenerator.generateReport(
      options.inputCsv!,
      reportOutput,
    )
  }
}

function setReportFlagTrue(options: CLIOptions): void {
  if (!options.report) {
    options.report = true
    console.log(
      "Note: --report flag automatically enabled when using --input-csv",
    )
  }
}

function getOutputNameForReport(options: CLIOptions): string {
  let reportOutput =
    options.output ||
    CLIService.resolveOutputPath("report.md", options.outputDir)

  if (
    reportOutput.endsWith("commits.csv") ||
    reportOutput.endsWith("/commits.csv")
  ) {
    reportOutput = CLIService.resolveOutputPath("report.md", options.outputDir)
  } else if (!reportOutput.endsWith(".md")) {
    // If user specified output but it's not .md, append .md
    reportOutput = reportOutput.replace(/\.[^.]+$/, "") + ".md"
  }
  return reportOutput
}

