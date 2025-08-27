import { AnalyzedCommit } from "@domain/analyzed-commit"
import {
  CommitStatistics,
  ReportGenerationService,
} from "@domain/report-generation-service"

import { ICommandHandler } from "@presentation/command-handler.interface"
import { ConsoleFormatter } from "@presentation/console-formatter"
import { IStorageRepository } from "@presentation/storage-repository.interface"

export interface GenerateReportCommand {
  inputCsvPath?: string
  analyzedCommits?: AnalyzedCommit[]
  outputPath: string
  includeStatistics?: boolean
}

export interface GenerateReportResult {
  reportPath: string
  statistics: CommitStatistics
  commitsProcessed: number
}

export class GenerateReportUseCase
  implements ICommandHandler<GenerateReportCommand, GenerateReportResult>
{
  constructor(
    private readonly reportGenerationService: ReportGenerationService,
    private readonly storageRepository: IStorageRepository,
  ) {}

  async handle(command: GenerateReportCommand): Promise<GenerateReportResult> {
    const {
      inputCsvPath,
      analyzedCommits,
      outputPath,
      includeStatistics = true,
    } = command

    let commits: AnalyzedCommit[]

    // Get commits from either CSV file or provided commits
    if (inputCsvPath) {
      ConsoleFormatter.logInfo(`Reading CSV data from ${inputCsvPath}...`)
      commits = await this.storageRepository.importFromCSV(inputCsvPath)
    } else if (analyzedCommits) {
      commits = analyzedCommits
    } else {
      throw new Error("Either inputCsvPath or analyzedCommits must be provided")
    }

    if (commits.length === 0) {
      throw new Error("No commits found for report generation")
    }

    // Generate statistics
    const statistics = this.reportGenerationService.generateStatistics(commits)

    ConsoleFormatter.logInfo(
      `Found ${statistics.totalCommits} commits spanning ${statistics.yearRange.min}-${statistics.yearRange.max}`,
    )
    ConsoleFormatter.logInfo(
      `Categories: ${statistics.categoryBreakdown.feature} features, ${statistics.categoryBreakdown.process} process, ${statistics.categoryBreakdown.tweak} tweaks`,
    )

    // Generate and save the report
    ConsoleFormatter.logInfo("Generating condensed report...")
    await this.generateMarkdownReport(
      commits,
      statistics,
      outputPath,
      includeStatistics,
    )

    ConsoleFormatter.logSuccess(`Report generated: ${outputPath}`)

    return {
      reportPath: outputPath,
      statistics,
      commitsProcessed: commits.length,
    }
  }

  private async generateMarkdownReport(
    commits: AnalyzedCommit[],
    _statistics: CommitStatistics,
    outputPath: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _includeStatistics: boolean,
  ): Promise<void> {
    // Note: reportContent assembly is currently handled by storageRepository.generateReport
    // This method could be enhanced to use the statistics for custom report formatting

    // Save the report using the storage repository
    await this.storageRepository.generateReport(commits, outputPath)
  }

  private generateStatisticsSection(statistics: CommitStatistics): string {
    let content = "## Analysis Summary\n\n"

    content += `**Total Commits Analyzed:** ${statistics.totalCommits}\n`
    content += `**Time Period:** ${statistics.yearRange.min} - ${statistics.yearRange.max}\n`
    content += `**Large Changes:** ${statistics.largeChanges} commits\n\n`

    content += "### Breakdown by Category\n\n"
    content += `- **Features:** ${statistics.categoryBreakdown.feature} commits\n`
    content += `- **Process/Infrastructure:** ${statistics.categoryBreakdown.process} commits\n`
    content += `- **Tweaks/Fixes:** ${statistics.categoryBreakdown.tweak} commits\n\n`

    content += "### Yearly Activity\n\n"
    for (const [year, count] of Object.entries(
      statistics.yearlyBreakdown,
    ).sort()) {
      content += `- **${year}:** ${count} commits\n`
    }

    return content
  }

  private generateYearlySummaries(commits: AnalyzedCommit[]): string {
    const commitsByYear = this.reportGenerationService.groupByYear(commits)
    const sortedYears = Array.from(commitsByYear.keys()).sort((a, b) => b - a) // Newest first

    let content = "## Yearly Development Highlights\n\n"

    for (const year of sortedYears) {
      const yearCommits = commitsByYear.get(year)!
      content += this.generateYearSection(year, yearCommits)
      content += "\n"
    }

    return content
  }

  private generateYearSection(year: number, commits: AnalyzedCommit[]): string {
    const features = commits.filter((c) => c.getAnalysis().isFeatureAnalysis())
    const significantCommits =
      this.reportGenerationService.getSignificantCommits(commits)

    let content = `### ${year}\n\n`
    content += `${commits.length} commits total, including ${features.length} new features.\n\n`

    if (significantCommits.length > 0) {
      content += "**Key Developments:**\n"
      for (const commit of significantCommits.slice(0, 5)) {
        // Top 5 significant commits
        content += `- ${commit.getAnalysis().getSummary()} (${commit.getShortHash()})\n`
      }
      content += "\n"
    }

    return content
  }
}
