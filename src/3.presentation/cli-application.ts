import { Command } from "commander"

import { getErrorMessage } from "../utils"

import { CommitAnalysisController } from "./commit-analysis-controller"
import { ConsoleFormatter } from "./console-formatter"

export interface CLIOptions {
  output?: string
  outputDir?: string
  commits: string[]
  author?: string
  limit?: number
  resume?: boolean
  clear?: boolean
  llm?: string
  report?: boolean
  inputCsv?: string
  verbose?: boolean
  since?: string
  until?: string
  noCache?: boolean
  batchSize?: number
}

export class CLIApplication {
  private static readonly VERSION = "1.1.1"
  private static readonly DEFAULT_COMMITS_OUTPUT_FILE = "results/commits.csv"
  private static readonly DEFAULT_REPORT_OUTPUT_FILE = "results/report.md"

  constructor(private readonly controller: CommitAnalysisController) {}

  async run(args: string[]): Promise<void> {
    try {
      const program = this.createProgram()
      await program.parseAsync(args)
    } catch (error) {
      ConsoleFormatter.logError(getErrorMessage(error))
      process.exit(1)
    }
  }

  private createProgram(): Command {
    const program = new Command()

    program
      .name("commit-analyzer")
      .description(
        "Analyze user authored git commits and generate rich commit descriptions and stakeholder reports from them.",
      )
      .version(CLIApplication.VERSION)
      .option(
        "-o, --output <file>",
        `Output CSV file (default: ${CLIApplication.DEFAULT_COMMITS_OUTPUT_FILE})`,
      )
      .option(
        "--output-dir <dir>",
        "Output directory for CSV and report files (default: current directory)",
      )
      .option(
        "-a, --author <email>",
        "Filter commits by author email (defaults to current user)",
      )
      .option(
        "-l, --limit <number>",
        "Limit number of commits to analyze",
        parseInt,
      )
      .option("-r, --resume", "Resume from last checkpoint if available")
      .option("-c, --clear", "Clear any existing progress checkpoint")
      .option("--llm <llm>", "LLM CLI tool to use (claude, gemini, openai)")
      .option(
        "--report",
        "Generate condensed markdown report from existing CSV",
      )
      .option(
        "--input-csv <file>",
        "Input CSV file to read for report generation",
      )
      .option(
        "-v, --verbose",
        "Enable verbose logging (shows detailed error information)",
      )
      .option(
        "--since <date>",
        "Only analyze commits since this date (YYYY-MM-DD, '1 week ago', '2024-01-01')",
      )
      .option(
        "--until <date>",
        "Only analyze commits until this date (YYYY-MM-DD, '1 day ago', '2024-12-31')",
      )
      .option("--no-cache", "Disable caching of analysis results")
      .option(
        "--batch-size <number>",
        "Number of commits to process per batch (default: 1 for sequential processing)",
        parseInt,
      )
      .argument(
        "[commits...]",
        "Commit hashes to analyze (if none provided, uses current user's commits)",
      )
      .action(async (commits: string[], options: Record<string, unknown>) => {
        const cliOptions = this.parseOptions(options, commits)
        await this.executeCommand(cliOptions)
      })
    return program
  }

  private parseOptions(
    options: Record<string, unknown>,
    args: string[],
  ): CLIOptions {
    const { commits } = this.determineCommitsToAnalyze(args)
    return {
      output: this.determineOutputPath(
        this.getStringOption(options.output),
        this.getStringOption(options.outputDir),
      ),
      outputDir: this.getStringOption(options.outputDir),
      commits,
      author: this.getStringOption(options.author),
      limit: this.getNumberOption(options.limit),
      resume: this.getBooleanOption(options.resume),
      clear: this.getBooleanOption(options.clear),
      llm: this.getStringOption(options.llm),
      report: this.getBooleanOption(options.report),
      inputCsv: this.getStringOption(options.inputCsv),
      verbose: this.getBooleanOption(options.verbose),
      since: this.getStringOption(options.since),
      until: this.getStringOption(options.until),
      noCache: this.getBooleanOption(options.noCache),
      batchSize: this.getNumberOption(options.batchSize),
    }
  }

  private getStringOption(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined
  }

  private getNumberOption(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined
  }

  private getBooleanOption(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined
  }

  private async executeCommand(options: CLIOptions): Promise<void> {
    // Handle clear flag
    if (options.clear) {
      await this.controller.handleClearProgress()
      if (!options.resume) {
        return
      }
    }

    // Handle input CSV mode (report generation only)
    if (options.inputCsv) {
      await this.controller.handleReportGeneration({
        inputCsv: options.inputCsv,
        output: options.output || CLIApplication.DEFAULT_REPORT_OUTPUT_FILE,
        sourceInfo: { type: "csv", value: options.inputCsv },
      })
      return
    }

    // Handle resume mode
    if (options.resume) {
      const resumed = await this.controller.handleResumeAnalysis({
        verbose: options.verbose,
      })

      if (resumed && options.report) {
        const reportOutput = options.output
          ? this.getReportOutputPath(options.output)
          : CLIApplication.DEFAULT_REPORT_OUTPUT_FILE

        await this.controller.handleReportGeneration({
          inputCsv: options.output,
          output: reportOutput,
          sourceInfo: {
            type: "csv",
            value: options.output || CLIApplication.DEFAULT_COMMITS_OUTPUT_FILE,
          },
        })
      }
      return
    }

    // Handle normal analysis mode
    const analyzeOptions = {
      commits: options.commits,
      output: options.output!,
      author: options.author,
      limit: options.limit,
      verbose: options.verbose,
      since: options.since,
      until: options.until,
      batchSize: options.batchSize,
    }

    if (options.report) {
      // Analysis + Report workflow
      const reportOutput = options.output
        ? this.getReportOutputPath(options.output)
        : CLIApplication.DEFAULT_REPORT_OUTPUT_FILE

      await this.controller.handleAnalysisWithReport(analyzeOptions, {
        output: reportOutput,
        sourceInfo:
          options.commits.length > 0
            ? { type: "commits", value: options.commits.join(",") }
            : { type: "author", value: options.author || "current user" },
      })
    } else {
      // Analysis only workflow
      await this.controller.handleAnalysis(analyzeOptions)
    }
  }

  private determineCommitsToAnalyze(args: string[]): { commits: string[] } {
    let commits: string[] = []
    if (args.length > 0) {
      commits = args
    }
    return { commits }
  }

  private determineOutputPath(
    outputOption?: string,
    outputDir?: string,
  ): string {
    if (outputOption) {
      return outputOption
    }
    if (outputDir) {
      return `${outputDir}/commits.csv`
    }
    return CLIApplication.DEFAULT_COMMITS_OUTPUT_FILE
  }

  private getReportOutputPath(csvPath: string): string {
    // If no specific output path provided, use the default report path
    if (!csvPath) {
      return CLIApplication.DEFAULT_REPORT_OUTPUT_FILE
    }

    // Extract directory from CSV path and use report.md as filename
    if (csvPath.endsWith(".csv")) {
      const dir = csvPath.substring(0, csvPath.lastIndexOf("/"))
      return dir ? `${dir}/report.md` : "report.md"
    }
    return csvPath + ".md"
  }
}
