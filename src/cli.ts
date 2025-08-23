import { readFileSync, mkdirSync } from "fs"
import { Command } from "commander"
import { join, dirname } from "path"

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

export class CLIService {
  static parseArguments(): CLIOptions {
    const program = new Command()

    program
      .name("commit-analyzer")
      .description("Analyze git commits and generate categorized summaries")
      .version("1.0.0")
      .option("-o, --output <file>", "Output CSV file (default: commits.csv)")
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
      .option(
        "-r, --resume",
        "Resume from last checkpoint if available",
      )
      .option(
        "-c, --clear",
        "Clear any existing progress checkpoint",
      )
      .option(
        "-m, --model <model>",
        "LLM model to use (claude, gemini, codex)",
      )
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
      .parse()

    const options = program.opts()
    const args = program.args

    let commits: string[] = []
    let useDefaults = false

    if (options.file) {
      commits = this.readCommitsFromFile(options.file)
    } else if (args.length > 0) {
      commits = args
    } else {
      useDefaults = true
    }

    return {
      output: options.output || CLIService.resolveOutputPath("commits.csv", options.outputDir),
      outputDir: options.outputDir,
      file: options.file,
      commits,
      author: options.author,
      limit: options.limit,
      useDefaults,
      resume: options.resume,
      clear: options.clear,
      model: options.model,
      report: options.report,
      inputCsv: options.inputCsv,
      verbose: options.verbose,
    }
  }

  private static readCommitsFromFile(filename: string): string[] {
    try {
      const content = readFileSync(filename, "utf8")
      return content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    } catch (error) {
      throw new Error(
        `Failed to read commits from file ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  /**
   * Resolve the full file path with optional output directory.
   */
  static resolveOutputPath(filename: string, outputDir?: string): string {
    if (outputDir) {
      // Ensure output directory exists
      try {
        mkdirSync(outputDir, { recursive: true })
      } catch (error) {
        throw new Error(
          `Failed to create output directory ${outputDir}: ${error instanceof Error ? error.message : "Unknown error"}`,
        )
      }
      return join(outputDir, filename)
    }
    return filename
  }

  static showHelp(): void {
    console.log(`
Usage: commit-analyzer [options] [commits...]

Analyze git commits and generate categorized summaries using LLM.
If no commits are specified, analyzes all commits authored by the current user.

Options:
  -o, --output <file>     Output file (default: commits.csv for analysis, report.md for reports)
  --output-dir <dir>      Output directory for CSV and report files (default: current directory)
  -f, --file <file>       Read commit hashes from file (one per line)
  -a, --author <email>  Filter commits by author email (defaults to current user)
  -l, --limit <number>  Limit number of commits to analyze
  -r, --resume          Resume from last checkpoint if available
  -c, --clear           Clear any existing progress checkpoint
  --report              Generate condensed markdown report from existing CSV
  --input-csv <file>    Input CSV file to read for report generation
  -v, --verbose         Enable verbose logging (shows detailed error information)
  -h, --help           Display help for command
  -V, --version        Display version number

Examples:
  commit-analyzer                                    # Analyze your authored commits
  commit-analyzer --limit 10                         # Analyze your last 10 commits
  commit-analyzer --author user@example.com          # Analyze specific user's commits
  commit-analyzer abc123 def456 ghi789               # Analyze specific commits
  commit-analyzer --file commits.txt                 # Read commits from file
  commit-analyzer --output analysis.csv --limit 20   # Analyze last 20 commits to custom file
  commit-analyzer --resume                           # Resume from last checkpoint
  commit-analyzer --clear                            # Clear checkpoint and start fresh
  commit-analyzer --report                           # Analyze commits, generate CSV, then generate report
  commit-analyzer --input-csv data.csv --report      # Skip analysis, generate report from existing CSV
  commit-analyzer --report -o custom-report.md       # Analyze commits, generate CSV, then generate custom report
    `)
  }
}

