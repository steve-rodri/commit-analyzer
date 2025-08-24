import { writeFileSync } from "fs"
import { AnalyzedCommit, CSVRow } from "./types"

export class CSVService {
  private static readonly CSV_HEADERS = "year,category,summary,description"
  private static readonly CSV_ENCODING = "utf8"
  private static readonly CSV_SPECIAL_CHARS = [",", '"', "\n"]

  static generateCSV(commits: AnalyzedCommit[]): string {
    const rows = commits.map((commit) => this.formatRow(commit))
    return [this.CSV_HEADERS, ...rows].join("\n")
  }

  static exportToFile(commits: AnalyzedCommit[], filename: string): void {
    const csvContent = this.generateCSV(commits)
    writeFileSync(filename, csvContent, this.CSV_ENCODING)
  }

  private static formatRow(commit: AnalyzedCommit): string {
    const row = this.extractRowData(commit)
    return this.joinCsvFields(row)
  }

  private static extractRowData(commit: AnalyzedCommit): CSVRow {
    return {
      year: commit.year,
      category: commit.analysis.category,
      summary: commit.analysis.summary,
      description: commit.analysis.description,
    }
  }

  private static joinCsvFields(row: CSVRow): string {
    return [
      row.year,
      this.escapeCsvField(row.category),
      this.escapeCsvField(row.summary),
      this.escapeCsvField(row.description),
    ].join(",")
  }

  private static escapeCsvField(field: string): string {
    if (this.needsEscaping(field)) {
      return this.escapeAndQuoteField(field)
    }
    return field
  }

  private static needsEscaping(field: string): boolean {
    return this.CSV_SPECIAL_CHARS.some(char => field.includes(char))
  }

  private static escapeAndQuoteField(field: string): string {
    return `"${field.replace(/"/g, '""')}"`
  }
}

