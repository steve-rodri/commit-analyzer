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
   * Determines the appropriate time period for summaries based on date range
   */
  determineTimePeriod(commits: AnalyzedCommit[]): 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' {
    if (commits.length === 0) return 'yearly'

    const dates = commits.map(c => c.getDate())
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
    
    const diffInMilliseconds = maxDate.getTime() - minDate.getTime()
    const diffInDays = diffInMilliseconds / (1000 * 60 * 60 * 24)

    if (diffInDays <= 1) return 'daily'
    if (diffInDays <= 7) return 'weekly'
    if (diffInDays <= 31) return 'monthly'
    if (diffInDays <= 93) return 'quarterly' // ~3 months
    return 'yearly'
  }

  /**
   * Groups commits by the appropriate time period
   */
  groupByTimePeriod(commits: AnalyzedCommit[], period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'): Map<string, AnalyzedCommit[]> {
    const grouped = new Map<string, AnalyzedCommit[]>()

    for (const commit of commits) {
      const date = commit.getDate()
      let key: string

      switch (period) {
        case 'daily':
          key = this.formatDailyKey(date)
          break
        case 'weekly':
          key = this.formatWeeklyKey(date)
          break
        case 'monthly':
          key = this.formatMonthlyKey(date)
          break
        case 'quarterly':
          key = this.formatQuarterlyKey(date)
          break
        case 'yearly':
        default:
          key = date.getFullYear().toString()
          break
      }

      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(commit)
    }

    return grouped
  }

  private formatDailyKey(date: Date): string {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours()

    if (hour < 12) return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} Morning`
    if (hour < 17) return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} Afternoon`
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} Evening`
  }

  private formatWeeklyKey(date: Date): string {
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay())
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)

    const formatDate = (d: Date) => 
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`

    return `Week of ${formatDate(startOfWeek)} to ${formatDate(endOfWeek)}`
  }

  private formatMonthlyKey(date: Date): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December']
    return `${months[date.getMonth()]} ${date.getFullYear()}`
  }

  private formatQuarterlyKey(date: Date): string {
    const quarter = Math.floor(date.getMonth() / 3) + 1
    return `Q${quarter} ${date.getFullYear()}`
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
   * Converts grouped commits to CSV with time period information
   */
  convertGroupedToCSV(groupedCommits: Map<string, AnalyzedCommit[]>, period: string): string {
    const header = `${period},category,summary,description`
    const rows: string[] = []
    
    for (const [timePeriod, commits] of groupedCommits) {
      for (const commit of commits) {
        const analysis = commit.getAnalysis()
        rows.push([
          this.escapeCsvField(timePeriod),
          this.escapeCsvField(analysis.getCategory().getValue()),
          this.escapeCsvField(analysis.getSummary()),
          this.escapeCsvField(analysis.getDescription()),
        ].join(","))
      }
    }

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
