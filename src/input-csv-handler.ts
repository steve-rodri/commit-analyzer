import { CLIService, CLIOptions } from "./cli"
import { MarkdownReportGenerator } from "./report-generator"
import { ConsoleUtils } from "./console-utils"

export class InputCsvHandler {
  private static readonly DEFAULT_REPORT_FILE = "report.md"

  static async handleInputCsvMode(options: CLIOptions): Promise<void> {
    ConsoleUtils.logInfo("Generating report from existing CSV...")
    
    this.ensureReportEnabled(options)
    const reportOutput = this.determineReportOutput(options)
    
    await MarkdownReportGenerator.generateReport(
      options.inputCsv!,
      reportOutput,
    )
  }

  private static ensureReportEnabled(options: CLIOptions): void {
    if (!options.report) {
      options.report = true
      ConsoleUtils.logInfo(
        "Note: --report flag automatically enabled when using --input-csv",
      )
    }
  }

  private static determineReportOutput(options: CLIOptions): string {
    const baseOutput = options.output || 
      CLIService.resolveOutputPath(this.DEFAULT_REPORT_FILE, options.outputDir)

    return this.normalizeReportPath(baseOutput, options.outputDir)
  }

  private static normalizeReportPath(output: string, outputDir?: string): string {
    if (this.isDefaultCsvOutput(output)) {
      return CLIService.resolveOutputPath(this.DEFAULT_REPORT_FILE, outputDir)
    }
    
    if (!output.endsWith(".md")) {
      return output.replace(/\.[^.]+$/, "") + ".md"
    }
    
    return output
  }

  private static isDefaultCsvOutput(output: string): boolean {
    return output.endsWith("commits.csv") || output.endsWith("/commits.csv")
  }
}

