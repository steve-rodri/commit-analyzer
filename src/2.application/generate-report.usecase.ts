import { AnalyzedCommit } from "@domain/analyzed-commit"
import { DateFormattingService } from "@domain/date-formatting-service"
import {
  CommitStatistics,
  ReportGenerationService,
} from "@domain/report-generation-service"

import { ICommandHandler } from "@presentation/command-handler.interface"
import { IStorageRepository } from "@presentation/storage-repository.interface"
import { IVersionControlService } from "@presentation/version-control-service.interface"

import { ILLMService } from "./llm-service"

export interface GenerateReportCommand {
  inputCsvPath?: string
  analyzedCommits?: AnalyzedCommit[]
  outputPath: string
  includeStatistics?: boolean
  sourceInfo?: {
    type: 'author' | 'commits' | 'csv'
    value: string // email address, commit hashes, or csv file path
  }
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
    private readonly llmService: ILLMService,
    private readonly dateFormattingService: DateFormattingService,
    private readonly versionControlService: IVersionControlService,
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
      console.log(`Reading CSV data from ${inputCsvPath}...`)
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

    // Format date range based on commit span
    const dateRange = this.dateFormattingService.formatDateRange(commits)

    console.log(
      `Found ${statistics.totalCommits} commits spanning ${dateRange}`,
    )
    console.log(
      `Categories: ${statistics.categoryBreakdown.feature} features, ${statistics.categoryBreakdown.process} process, ${statistics.categoryBreakdown.tweak} tweaks`,
    )

    // Generate and save the report
    console.log("Generating condensed report...")
    await this.generateMarkdownReportWithLLM({
      commits,
      statistics,
      outputPath,
      includeStatistics,
      sourceInfo: command.sourceInfo,
    })

    return {
      reportPath: outputPath,
      statistics,
      commitsProcessed: commits.length,
    }
  }

  private async generateMarkdownReportWithLLM(params: {
    commits: AnalyzedCommit[]
    statistics: CommitStatistics
    outputPath: string
    includeStatistics: boolean
    sourceInfo?: { type: 'author' | 'commits' | 'csv'; value: string }
  }): Promise<void> {
    const { commits, statistics, outputPath, includeStatistics, sourceInfo } = params
    
    // Get repository name for the report heading
    const repositoryName = await this.versionControlService.getRepositoryName()
    let reportContent = `# Development Report for ${repositoryName}\n\n`

    if (includeStatistics) {
      reportContent += this.generateAnalysisSection(commits, statistics, sourceInfo)
      reportContent += "\n\n"
    }

    // Generate sophisticated yearly summaries using LLM
    reportContent += await this.generateYearlySummariesWithLLM(commits)

    // Write the final report using the storage repository
    await this.storageRepository.writeFile(outputPath, reportContent)
  }

  /**
   * Generate commit analysis section with accurate counts (like the original)
   */
  private generateAnalysisSection(
    commits: AnalyzedCommit[],
    statistics: CommitStatistics,
    sourceInfo?: { type: 'author' | 'commits' | 'csv'; value: string }
  ): string {
    // Get formatted date range using the date formatting service
    const dateRange = this.dateFormattingService.formatDateRange(commits)
    // Group data by year for detailed breakdown
    const yearlyStats = commits.reduce(
      (acc, commit) => {
        const year = commit.getYear()
        const category = commit.getAnalysis().getCategory().getValue()
        
        if (!acc[year]) {
          acc[year] = { tweak: 0, feature: 0, process: 0, total: 0 }
        }
        acc[year][category]++
        acc[year].total++
        return acc
      },
      {} as Record<
        number,
        { tweak: number; feature: number; process: number; total: number }
      >,
    )

    // Sort years in descending order
    const sortedYears = Object.keys(yearlyStats)
      .map(Number)
      .sort((a, b) => b - a)

    let analysisContent = `## Commit Analysis\n`
    analysisContent += `- **Total Commits**: ${statistics.totalCommits} commits spanning ${dateRange}\n`
    
    // Add source information
    if (sourceInfo) {
      switch (sourceInfo.type) {
        case 'author':
          analysisContent += `- **Source**: Commits by author ${sourceInfo.value}\n`
          break
        case 'commits': {
          const commitCount = sourceInfo.value.split(',').length
          analysisContent += `- **Source**: ${commitCount} specific commit${commitCount > 1 ? 's' : ''}\n`
          break
        }
        case 'csv':
          analysisContent += `- **Source**: Imported from ${sourceInfo.value}\n`
          break
      }
    }

    // Add year-by-year breakdown
    for (const year of sortedYears) {
      const yearData = yearlyStats[year]
      analysisContent += `- **${year}**: ${yearData.total} commits (${yearData.feature} features, ${yearData.process} process, ${yearData.tweak} tweaks)\n`
    }

    return analysisContent
  }

  /**
   * Generate sophisticated time-period-based summaries using LLM service
   */
  private async generateYearlySummariesWithLLM(
    commits: AnalyzedCommit[],
  ): Promise<string> {
    // Determine the appropriate time period for the report
    const timePeriod = this.reportGenerationService.determineTimePeriod(commits)
    
    // Group commits by the determined time period
    const groupedCommits = this.reportGenerationService.groupByTimePeriod(commits, timePeriod)
    
    // Convert grouped commits to CSV format for LLM consumption
    const csvContent = this.reportGenerationService.convertGroupedToCSV(groupedCommits, timePeriod)

    try {
      // Use the LLM service to generate sophisticated time-period-based summaries
      const summaryContent = await this.llmService.generateTimePeriodSummariesFromCSV(csvContent, timePeriod)
      return summaryContent
    } catch (error) {
      throw new Error(
        `Failed to generate ${timePeriod} summaries: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }
}
