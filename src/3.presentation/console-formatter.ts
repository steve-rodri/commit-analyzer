/**
 * Console formatter for consistent output styling
 */
export class ConsoleFormatter {
  /**
   * Log a success message with checkmark
   */
  static logSuccess(message: string): void {
    console.log(`✓ ${message}`)
  }

  /**
   * Log an error message with X mark
   */
  static logError(message: string): void {
    console.error(`❌ ${message}`)
  }

  /**
   * Log a warning message with warning icon
   */
  static logWarning(message: string): void {
    console.log(`⚠️  ${message}`)
  }

  /**
   * Log a debug message for development purposes
   */
  static logDebug(message: string): void {
    console.log(`🐛 ${message}`)
  }

  /**
   * Log an info message with bullet point
   */
  static logInfo(message: string): void {
    console.log(`  - ${message}`)
  }

  /**
   * Log a progress message with arrow
   */
  static logProgress(message: string): void {
    console.log(`▶️  ${message}`)
  }

  /**
   * Log a completion message with celebration icon
   */
  static logComplete(message: string): void {
    console.log(`🎉 ${message}`)
  }

  /**
   * Log a file operation with folder icon
   */
  static logFile(message: string): void {
    console.log(`📁 ${message}`)
  }

  /**
   * Log a save operation with disk icon
   */
  static logSave(message: string): void {
    console.log(`💾 ${message}`)
  }

  /**
   * Log a report generation with chart icon
   */
  static logReport(message: string): void {
    console.log(`📊 ${message}`)
  }

  /**
   * Log with indentation for nested information
   */
  static logIndented(message: string, level: number = 1): void {
    const indent = '  '.repeat(level)
    console.log(`${indent}${message}`)
  }

  /**
   * Log a section header with newlines for spacing
   */
  static logSection(title: string): void {
    console.log(`\n${title}`)
  }

  /**
   * Log with custom emoji/icon
   */
  static logWithIcon(icon: string, message: string): void {
    console.log(`${icon} ${message}`)
  }

  /**
   * Display analysis summary in a formatted way
   */
  static displayAnalysisSummary(summary: Record<string, number>): void {
    this.logSection("Summary by category:")
    Object.entries(summary).forEach(([category, count]) => {
      this.logInfo(`${category}: ${count} commits`)
    })
  }
}