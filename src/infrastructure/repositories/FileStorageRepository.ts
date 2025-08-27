import { IStorageRepository } from "../../domain/repositories/IStorageRepository"
import { IStorageService } from "../../application/ports/out/IStorageService"
import { AnalyzedCommit } from "../../domain/entities/AnalyzedCommit"
import { CSVExporter } from "../adapters/storage/CSVExporter"

/**
 * File-based storage repository implementation
 */
export class FileStorageRepository implements IStorageRepository {
  private readonly csvExporter: CSVExporter

  constructor(private readonly storageService: IStorageService) {
    this.csvExporter = new CSVExporter(storageService)
  }

  async exportToCSV(commits: AnalyzedCommit[], filePath: string): Promise<void> {
    await this.csvExporter.exportToCSV(commits, filePath)
  }

  async importFromCSV(filePath: string): Promise<AnalyzedCommit[]> {
    return this.csvExporter.importFromCSV(filePath)
  }

  async generateReport(commits: AnalyzedCommit[], outputPath: string): Promise<void> {
    // Generate markdown report content
    const reportContent = this.generateMarkdownReport(commits)
    await this.storageService.writeFile(outputPath, reportContent)
  }

  async readCommitHashesFromFile(filePath: string): Promise<string[]> {
    return this.storageService.readLines(filePath)
  }

  async ensureDirectoryExists(directoryPath: string): Promise<void> {
    await this.storageService.ensureDirectory(directoryPath)
  }

  private generateMarkdownReport(commits: AnalyzedCommit[]): string {
    let content = "# Development Summary Report\n\n"
    
    // Basic statistics
    const totalCommits = commits.length
    const years = commits.map(c => c.getYear())
    const minYear = Math.min(...years)
    const maxYear = Math.max(...years)
    
    const categoryBreakdown = commits.reduce((acc, commit) => {
      const category = commit.getAnalysis().getCategory().getValue()
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    content += `## Analysis Summary\n\n`
    content += `**Total Commits Analyzed:** ${totalCommits}\n`
    content += `**Time Period:** ${minYear} - ${maxYear}\n\n`
    
    content += `### Breakdown by Category\n\n`
    content += `- **Features:** ${categoryBreakdown.feature || 0} commits\n`
    content += `- **Process/Infrastructure:** ${categoryBreakdown.process || 0} commits\n`
    content += `- **Tweaks/Fixes:** ${categoryBreakdown.tweak || 0} commits\n\n`

    // Group by year and add yearly summaries
    const commitsByYear = new Map<number, AnalyzedCommit[]>()
    for (const commit of commits) {
      const year = commit.getYear()
      if (!commitsByYear.has(year)) {
        commitsByYear.set(year, [])
      }
      commitsByYear.get(year)!.push(commit)
    }

    content += `## Yearly Development Highlights\n\n`
    
    const sortedYears = Array.from(commitsByYear.keys()).sort((a, b) => b - a)
    for (const year of sortedYears) {
      const yearCommits = commitsByYear.get(year)!
      const features = yearCommits.filter(c => c.getAnalysis().isFeatureAnalysis())
      
      content += `### ${year}\n\n`
      content += `${yearCommits.length} commits total, including ${features.length} new features.\n\n`
      
      // Show top features
      if (features.length > 0) {
        content += `**Key Features:**\n`
        for (const feature of features.slice(0, 5)) {
          content += `- ${feature.getAnalysis().getSummary()}\n`
        }
        content += '\n'
      }
    }

    return content
  }
}