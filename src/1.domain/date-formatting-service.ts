import { AnalyzedCommit } from "./analyzed-commit"

/**
 * Domain service for formatting date ranges based on time periods
 */
export class DateFormattingService {
  /**
   * Format date range based on the span of commits
   */
  formatDateRange(commits: AnalyzedCommit[]): string {
    const dates = commits.map(c => c.getDate())
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
    
    const diffInMilliseconds = maxDate.getTime() - minDate.getTime()
    const diffInDays = diffInMilliseconds / (1000 * 60 * 60 * 24)
    
    
    // For very small differences, use a more conservative approach
    if (diffInDays < 0.05) { // Less than ~1 hour
      return this.formatHourlyRange(minDate, maxDate)
    } else if (diffInDays <= 1) {
      return this.formatDailyRange(minDate, maxDate)
    } else if (diffInDays <= 7) {
      return this.formatWeeklyRange(minDate, maxDate)
    } else if (diffInDays <= 31) {
      return this.formatMonthlyRange(minDate, maxDate)
    } else if (diffInDays <= 365) {
      return this.formatMonthlyRange(minDate, maxDate)
    } else {
      return this.formatYearlyRange(minDate, maxDate)
    }
  }


  private formatHourlyRange(minDate: Date, maxDate: Date): string {
    const formatTime = (date: Date) => {
      const hour = date.getHours()
      const ampm = hour < 12 ? 'am' : 'pm'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      return `${displayHour}${ampm}`
    }
    
    // If same time, just show the single time
    if (minDate.getTime() === maxDate.getTime()) {
      return formatTime(minDate)
    }
    
    return `${formatTime(minDate)} to ${formatTime(maxDate)}`
  }

  private formatDailyRange(minDate: Date, maxDate: Date): string {
    const minDay = minDate.toLocaleDateString('en-US', { weekday: 'long' })
    const maxDay = maxDate.toLocaleDateString('en-US', { weekday: 'long' })
    return `${minDay} to ${maxDay}`
  }

  private formatWeeklyRange(minDate: Date, maxDate: Date): string {
    const formatWeekly = (date: Date) => `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`
    return `${formatWeekly(minDate)} - ${formatWeekly(maxDate)}`
  }

  private formatMonthlyRange(minDate: Date, maxDate: Date): string {
    const minMonth = minDate.toLocaleDateString('en-US', { month: 'short' })
    const maxMonth = maxDate.toLocaleDateString('en-US', { month: 'short' })
    const minYear = minDate.getFullYear()
    const maxYear = maxDate.getFullYear()
    
    if (minYear === maxYear) {
      return `${minMonth} - ${maxMonth}`
    } else {
      return `${minMonth} ${minYear} - ${maxMonth} ${maxYear}`
    }
  }

  private formatYearlyRange(minDate: Date, maxDate: Date): string {
    const minYear = minDate.getFullYear()
    const maxYear = maxDate.getFullYear()
    return minYear === maxYear ? minYear.toString() : `${minYear} - ${maxYear}`
  }
}