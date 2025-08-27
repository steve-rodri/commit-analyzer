import { AnalyzedCommit } from "./analyzed-commit"
import { Category, CategoryType } from "./category"
import { DateRange } from "./date-range"

/**
 * Statistics for analyzed commits
 */
export interface CommitStatistics {
  totalCommits: number
  yearRange: {
    min: number
    max: number
  }
  categoryBreakdown: Record<CategoryType, number>
  yearlyBreakdown: Record<number, number>
  largeChanges: number
}

/**
 * Domain service for report generation operations
 */
export class ReportGenerationService {
  /**
   * Generates statistics from analyzed commits
   */
  generateStatistics(commits: AnalyzedCommit[]): CommitStatistics {
    if (commits.length === 0) {
      throw new Error("Cannot generate statistics from empty commit list")
    }

    const years = commits.map((c) => c.getYear())

    const categoryBreakdown: Record<CategoryType, number> = {
      tweak: 0,
      feature: 0,
      process: 0,
    }

    const yearlyBreakdown: Record<number, number> = {}
    let largeChanges = 0

    for (const commit of commits) {
      // Category breakdown
      const category = commit.getAnalysis().getCategory().getValue()
      categoryBreakdown[category]++

      // Yearly breakdown
      const year = commit.getYear()
      yearlyBreakdown[year] = (yearlyBreakdown[year] || 0) + 1

      // Large changes count
      if (commit.isLargeChange()) {
        largeChanges++
      }
    }

    return {
      totalCommits: commits.length,
      yearRange: {
        min: Math.min(...years),
        max: Math.max(...years),
      },
      categoryBreakdown,
      yearlyBreakdown,
      largeChanges,
    }
  }

  /**
   * Filters commits by date range
   */
  filterByDateRange(
    commits: AnalyzedCommit[],
    dateRange: DateRange,
  ): AnalyzedCommit[] {
    return commits.filter((commit) => dateRange.contains(commit.getDate()))
  }

  /**
   * Filters commits by category
   */
  filterByCategory(
    commits: AnalyzedCommit[],
    category: Category,
  ): AnalyzedCommit[] {
    return commits.filter((commit) =>
      commit.getAnalysis().getCategory().equals(category),
    )
  }

  /**
   * Groups commits by year
   */
  groupByYear(commits: AnalyzedCommit[]): Map<number, AnalyzedCommit[]> {
    const grouped = new Map<number, AnalyzedCommit[]>()

    for (const commit of commits) {
      const year = commit.getYear()
      if (!grouped.has(year)) {
        grouped.set(year, [])
      }
      grouped.get(year)!.push(commit)
    }

    return grouped
  }

  /**
   * Groups commits by category
   */
  groupByCategory(
    commits: AnalyzedCommit[],
  ): Map<CategoryType, AnalyzedCommit[]> {
    const grouped = new Map<CategoryType, AnalyzedCommit[]>()

    for (const commit of commits) {
      const category = commit.getAnalysis().getCategory().getValue()
      if (!grouped.has(category)) {
        grouped.set(category, [])
      }
      grouped.get(category)!.push(commit)
    }

    return grouped
  }

  /**
   * Sorts commits by date (newest first by default)
   */
  sortByDate(
    commits: AnalyzedCommit[],
    ascending: boolean = false,
  ): AnalyzedCommit[] {
    return commits.slice().sort((a, b) => {
      const aDate = a.getDate().getTime()
      const bDate = b.getDate().getTime()
      return ascending ? aDate - bDate : bDate - aDate
    })
  }

  /**
   * Gets the most significant commits (features and large changes)
   */
  getSignificantCommits(commits: AnalyzedCommit[]): AnalyzedCommit[] {
    return commits.filter(
      (commit) =>
        commit.getAnalysis().isFeatureAnalysis() || commit.isLargeChange(),
    )
  }

  /**
   * Converts analyzed commits to CSV string format for LLM consumption
   */
  convertToCSVString(commits: AnalyzedCommit[]): string {
    const header = "year,category,summary,description"
    const rows = commits.map((commit) => {
      const analysis = commit.getAnalysis()
      return [
        commit.getYear().toString(),
        this.escapeCsvField(analysis.getCategory().getValue()),
        this.escapeCsvField(analysis.getSummary()),
        this.escapeCsvField(analysis.getDescription()),
      ].join(",")
    })

    return [header, ...rows].join("\n")
  }

  /**
   * Escape CSV fields that contain commas, quotes, or newlines
   */
  private escapeCsvField(field: string): string {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }
}
