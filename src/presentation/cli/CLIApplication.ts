import { Command } from "commander"
import { CommitAnalysisController } from "../controllers/CommitAnalysisController"
import { ConsoleFormatter } from "./formatters/ConsoleFormatter"
import { getErrorMessage } from "../../utils"

/**
 * CLI options interface
 */
export interface CLIOptions {
  output?: string
  outputDir?: string
  file?: string
  commits: string[]
  author?: string
  limit?: number
  useDefaults: boolean
  resume?: boolean
  clear?: boolean
  model?: string
  report?: boolean
  inputCsv?: string
  verbose?: boolean
}

/**
 * Main CLI application
 */
export class CLIApplication {
  private static readonly DEFAULT_OUTPUT_FILE = "commits.csv"
  private static readonly DEFAULT_VERSION = "1.0.3"

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
      .version(CLIApplication.DEFAULT_VERSION)
      .option(
        "-o, --output <file>",
        `Output CSV file (default: ${CLIApplication.DEFAULT_OUTPUT_FILE})`,
      )
      .option(
        "--output-dir <dir>",
        "Output directory for CSV and report files (default: current directory)",
      )
      .option(
        "-f, --file <file>",
        "Read commit hashes from file (one per line)",
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
      .option("-m, --model <model>", "LLM model to use (claude, gemini, codex)")
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
    const { commits, useDefaults } = this.determineCommitsToAnalyze(
      { file: this.getStringOption(options.file) },
      args,
    )

    return {
      output: this.determineOutputPath(
        this.getStringOption(options.output), 
        this.getStringOption(options.outputDir)
      ),
      outputDir: this.getStringOption(options.outputDir),
      file: this.getStringOption(options.file),
      commits,
      author: this.getStringOption(options.author),
      limit: this.getNumberOption(options.limit),
      useDefaults,
      resume: this.getBooleanOption(options.resume),
      clear: this.getBooleanOption(options.clear),
      model: this.getStringOption(options.model),
      report: this.getBooleanOption(options.report),
      inputCsv: this.getStringOption(options.inputCsv),
      verbose: this.getBooleanOption(options.verbose),
    }
  }

  private getStringOption(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
  }

  private getNumberOption(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined
  }

  private getBooleanOption(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined
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
        output: options.output || "report.md",
      })
      return
    }

    // Handle resume mode
    if (options.resume) {
      const resumed = await this.controller.handleResumeAnalysis({
        verbose: options.verbose,
      })

      if (resumed && options.report) {
        await this.controller.handleReportGeneration({
          inputCsv: options.output,
          output: this.getReportOutputPath(options.output!),
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
      file: options.file,
      useDefaults: options.useDefaults,
    }

    if (options.report) {
      // Analysis + Report workflow
      await this.controller.handleAnalysisWithReport(analyzeOptions, {
        output: this.getReportOutputPath(options.output!),
      })
    } else {
      // Analysis only workflow
      await this.controller.handleAnalysis(analyzeOptions)
    }
  }

  private determineCommitsToAnalyze(
    options: { file?: string },
    args: string[],
  ): { commits: string[]; useDefaults: boolean } {
    let commits: string[] = []
    let useDefaults = false

    if (options.file) {
      // File reading will be handled by the command
      commits = []
    } else if (args.length > 0) {
      commits = args
    } else {
      useDefaults = true
    }

    return { commits, useDefaults }
  }

  private determineOutputPath(
    outputOption?: string,
    outputDir?: string,
  ): string {
    if (outputOption) {
      return outputOption
    }

    if (outputDir) {
      return `${outputDir}/${CLIApplication.DEFAULT_OUTPUT_FILE}`
    }

    return CLIApplication.DEFAULT_OUTPUT_FILE
  }

  private getReportOutputPath(csvPath: string): string {
    if (csvPath.endsWith(".csv")) {
      return csvPath.replace(".csv", ".md")
    }
    return csvPath + ".md"
  }
}

