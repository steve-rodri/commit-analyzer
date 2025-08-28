import { AnalyzedCommit } from "./analyzed-commit"
import { Category, CategoryType } from "./category"
import { DateRange } from "./date-range"

export type TimePeriod =
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"

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
  determineTimePeriod(commits: AnalyzedCommit[]): TimePeriod {
    if (commits.length === 0) return "yearly"

    const dates = commits.map((c) => c.getDate())
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

    const diffInMilliseconds = maxDate.getTime() - minDate.getTime()
    const diffInDays = diffInMilliseconds / (1000 * 60 * 60 * 24)

    if (diffInDays <= 1) return "hourly"
    if (diffInDays <= 7) return "daily"
    if (diffInDays <= 31) return "weekly"
    if (diffInDays <= 93) return "monthly" // ~3 months
    if (diffInDays <= 365) return "quarterly" // ~3 months
    return "yearly"
  }

  /**
   * Groups commits by the appropriate time period
   */
  groupByTimePeriod(
    commits: AnalyzedCommit[],
    period: TimePeriod,
  ): Map<string, AnalyzedCommit[]> {
    const grouped = new Map<string, AnalyzedCommit[]>()

    for (const commit of commits) {
      const date = commit.getDate()
      let key: string

      switch (period) {
        case "hourly":
          key = this.formatHourlyKey(date)
          break
        case "daily":
          key = this.formatDailyKey(date)
          break
        case "weekly":
          key = this.formatWeeklyKey(date)
          break
        case "monthly":
          key = this.formatMonthlyKey(date)
          break
        case "quarterly":
          key = this.formatQuarterlyKey(date)
          break
        case "yearly":
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

  private formatHourlyKey(date: Date): string {
    const hour = date.getHours()
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    const ampm = hour < 12 ? "AM" : "PM"
    return `${displayHour}:00 ${ampm}`
  }

  private formatDailyKey(date: Date): string {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours()

    if (hour < 12)
      return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")} Morning`
    if (hour < 17)
      return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")} Afternoon`
    return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")} Evening`
  }

  private formatWeeklyKey(date: Date): string {
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay())
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)

    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`

    return `Week of ${formatDate(startOfWeek)} to ${formatDate(endOfWeek)}`
  }

  private formatMonthlyKey(date: Date): string {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]
    return `${months[date.getMonth()]} ${date.getFullYear()}`
  }

  private formatQuarterlyKey(date: Date): string {
    const quarter = Math.floor(date.getMonth() / 3) + 1
    return `Q${quarter} ${date.getFullYear()}`
  }

  /**
   * Converts analyzed commits to CSV string format for LLM consumption with enhanced context
   */
  convertToCSVString(commits: AnalyzedCommit[]): string {
    const header = "year,category,summary,description,commit_count,date_range"

    // Group commits by year and category for context
    const contextMap = new Map<string, { count: number; dates: Date[] }>()

    const rows = commits.map((commit) => {
      const analysis = commit.getAnalysis()
      const key = `${commit.getYear()}-${analysis.getCategory().getValue()}`

      if (!contextMap.has(key)) {
        contextMap.set(key, { count: 0, dates: [] })
      }

      const context = contextMap.get(key)!
      context.count++
      context.dates.push(commit.getDate())

      const dateRange =
        context.dates.length > 1
          ? `${this.formatDate(Math.min(...context.dates.map((d) => d.getTime())))} to ${this.formatDate(Math.max(...context.dates.map((d) => d.getTime())))}`
          : this.formatDate(commit.getDate())

      return [
        commit.getYear().toString(),
        this.escapeCsvField(analysis.getCategory().getValue()),
        this.escapeCsvField(analysis.getSummary()),
        this.escapeCsvField(analysis.getDescription()),
        context.count.toString(),
        this.escapeCsvField(dateRange),
      ].join(",")
    })

    return [header, ...rows].join("\n")
  }

  private formatDate(date: Date | number): string {
    const d = new Date(date)
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`
  }

  /**
   * Converts grouped commits to CSV with time period information and enhanced context
   */
  convertGroupedToCSV(
    groupedCommits: Map<string, AnalyzedCommit[]>,
    period: string,
  ): string {
    const header = `${period},category,summary,description,commit_count,similar_commits`
    const rows: string[] = []

    for (const [timePeriod, commits] of groupedCommits) {
      // Group commits by category within the time period for context
      const categoryGroups = new Map<string, AnalyzedCommit[]>()

      for (const commit of commits) {
        const category = commit.getAnalysis().getCategory().getValue()
        if (!categoryGroups.has(category)) {
          categoryGroups.set(category, [])
        }
        categoryGroups.get(category)!.push(commit)
      }

      // Add context about similar commits in the same period and category
      for (const commit of commits) {
        const analysis = commit.getAnalysis()
        const category = analysis.getCategory().getValue()
        const similarCommits = categoryGroups.get(category)!

        // Find similar summaries in the same category
        const similarSummaries = similarCommits
          .filter((c) => c !== commit)
          .map((c) => c.getAnalysis().getSummary())
          .filter((summary) =>
            this.isSimilarSummary(analysis.getSummary(), summary),
          )
          .slice(0, 3) // Limit to 3 similar items

        rows.push(
          [
            this.escapeCsvField(timePeriod),
            this.escapeCsvField(category),
            this.escapeCsvField(analysis.getSummary()),
            this.escapeCsvField(analysis.getDescription()),
            similarCommits.length.toString(),
            this.escapeCsvField(similarSummaries.join("; ")),
          ].join(","),
        )
      }
    }

    return [header, ...rows].join("\n")
  }

  /**
   * Determines if two summaries are similar based on common keywords
   */
  private isSimilarSummary(summary1: string, summary2: string): boolean {
    const keywords1 = this.extractKeywords(summary1)
    const keywords2 = this.extractKeywords(summary2)

    // Check if they share significant keywords (at least 2 common words)
    const commonKeywords = keywords1.filter((word) => keywords2.includes(word))
    return commonKeywords.length >= 2
  }

  /**
   * Extracts meaningful keywords from a summary for similarity detection
   */
  private extractKeywords(summary: string): string[] {
    // Remove common stopwords and extract meaningful terms
    const stopwords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
    ])

    return summary
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopwords.has(word))
      .slice(0, 5) // Take first 5 meaningful words
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
