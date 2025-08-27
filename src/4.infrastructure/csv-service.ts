import { Analysis } from "@domain/analysis"
import { AnalyzedCommit } from "@domain/analyzed-commit"
import { Category } from "@domain/category"
import { Commit } from "@domain/commit"
import { CommitHash } from "@domain/commit-hash"

import { IStorageService } from "@presentation/storage-service.interface"

export class CSVService {
  private static readonly CSV_HEADERS = "year,category,summary,description"
  private static readonly CSV_SPECIAL_CHARS = [",", '"', "\n"]

  constructor(private readonly storageService: IStorageService) {}

  async exportToCSV(
    commits: AnalyzedCommit[],
    filePath: string,
  ): Promise<void> {
    const csvContent = this.generateCSV(commits)
    await this.storageService.writeFile(filePath, csvContent)
  }

  async importFromCSV(filePath: string): Promise<AnalyzedCommit[]> {
    const content = await this.storageService.readFile(filePath)
    return this.parseCSV(content)
  }

  private generateCSV(commits: AnalyzedCommit[]): string {
    const rows = commits.map((commit) => this.formatRow(commit))
    return [CSVService.CSV_HEADERS, ...rows].join("\n")
  }

  private formatRow(commit: AnalyzedCommit): string {
    const row = commit.toCSVRow()
    return this.joinCsvFields(row)
  }

  private joinCsvFields(row: {
    year: number
    category: string
    summary: string
    description: string
  }): string {
    return [
      row.year,
      this.escapeCsvField(row.category),
      this.escapeCsvField(row.summary),
      this.escapeCsvField(row.description),
    ].join(",")
  }

  private escapeCsvField(field: string): string {
    if (this.needsEscaping(field)) {
      return this.escapeAndQuoteField(field)
    }
    return field
  }

  private needsEscaping(field: string): boolean {
    return CSVService.CSV_SPECIAL_CHARS.some((char) => field.includes(char))
  }

  private escapeAndQuoteField(field: string): string {
    return `"${field.replace(/"/g, '""')}"`
  }

  private parseCSV(content: string): AnalyzedCommit[] {
    const lines = content.split("\n").filter((line) => line.trim().length > 0)

    if (lines.length < 2) {
      throw new Error("Invalid CSV format: no data rows found")
    }

    // Validate header
    const header = lines[0].toLowerCase()
    const expectedHeader = "year,category,summary,description"
    if (header !== expectedHeader) {
      throw new Error(
        `Invalid CSV format. Expected header: "${expectedHeader}", got: "${header}"`,
      )
    }

    // Skip header row
    const dataRows = lines.slice(1)
    const commits: AnalyzedCommit[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      try {
        const commit = this.parseCSVRow(row)
        commits.push(commit)
      } catch (error) {
        console.warn(`Warning: Failed to parse CSV row ${i + 2}: ${row}`)
        console.warn(`Error: ${error}`)
      }
    }

    return commits
  }

  private parseCSVRow(row: string): AnalyzedCommit {
    const fields = this.parseCSVFields(row)

    if (fields.length !== 4) {
      throw new Error(
        `Expected 4 fields (year,category,summary,description), got ${fields.length}`,
      )
    }

    const [yearStr, category, summary, description] = fields

    // Validate year
    const year = parseInt(yearStr, 10)
    if (isNaN(year) || year < 1900 || year > 2100) {
      throw new Error(`Invalid year: ${yearStr}`)
    }

    // Validate category
    if (!this.isValidCategory(category)) {
      throw new Error(
        `Invalid category: ${category}. Must be one of: tweak, feature, process`,
      )
    }

    // Validate required fields
    if (!summary.trim()) {
      throw new Error("Summary field cannot be empty")
    }

    if (!description.trim()) {
      throw new Error("Description field cannot be empty")
    }

    // Create a minimal commit object for CSV import (since we don't have the actual git data)
    // We'll use placeholder values for hash, date, and diff since they're not in the CSV
    const placeholderHash = CommitHash.create(
      "0000000000000000000000000000000000000000",
    )
    const placeholderDate = new Date(year, 0, 1) // January 1st of the year
    const placeholderDiff = "# Placeholder diff for CSV import\n+1\n-0" // Minimal valid diff
    const placeholderMessage = summary // Use summary as message

    const commit = new Commit({
      hash: placeholderHash,
      message: placeholderMessage,
      date: placeholderDate,
      diff: placeholderDiff,
    })

    // Create analysis from CSV data
    const analysisCategory = Category.create(category)
    const analysis = new Analysis({
      category: analysisCategory,
      summary: summary.trim(),
      description: description.trim(),
    })

    return new AnalyzedCommit(commit, analysis)
  }

  /**
   * Parse CSV fields handling quoted fields with commas and escaped quotes
   */
  private parseCSVFields(line: string): string[] {
    const fields: string[] = []
    let currentField = ""
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote inside quoted field
          currentField += '"'
          i += 2
        } else {
          // Start or end of quoted field
          inQuotes = !inQuotes
          i++
        }
      } else if (char === "," && !inQuotes) {
        // Field separator outside quotes
        fields.push(currentField)
        currentField = ""
        i++
      } else {
        // Regular character
        currentField += char
        i++
      }
    }

    // Add the last field
    fields.push(currentField)

    return fields
  }

  private isValidCategory(
    category: string,
  ): category is "tweak" | "feature" | "process" {
    return ["tweak", "feature", "process"].includes(category)
  }
}
