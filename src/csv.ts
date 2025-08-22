import { writeFileSync } from "fs"
import { AnalyzedCommit, CSVRow } from "./types"

export class CSVService {
  static generateCSV(commits: AnalyzedCommit[]): string {
    const headers = "year,category,summary,description"
    const rows = commits.map((commit) => this.formatRow(commit))

    return [headers, ...rows].join("\n")
  }

  static exportToFile(commits: AnalyzedCommit[], filename: string): void {
    const csvContent = this.generateCSV(commits)
    writeFileSync(filename, csvContent, "utf8")
  }

  private static formatRow(commit: AnalyzedCommit): string {
    const row: CSVRow = {
      year: commit.year,
      category: commit.analysis.category,
      summary: commit.analysis.summary,
      description: commit.analysis.description,
    }

    return [
      row.year,
      this.escapeCsvField(row.category),
      this.escapeCsvField(row.summary),
      this.escapeCsvField(row.description),
    ].join(",")
  }

  private static escapeCsvField(field: string): string {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }
}

