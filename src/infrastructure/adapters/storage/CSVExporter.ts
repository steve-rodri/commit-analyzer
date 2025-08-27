import { AnalyzedCommit } from "../../../domain/entities/AnalyzedCommit"
import { IStorageService } from "../../../application/ports/out/IStorageService"

/**
 * CSV export functionality
 */
export class CSVExporter {
  private static readonly CSV_HEADERS = "year,category,summary,description"
  private static readonly CSV_SPECIAL_CHARS = [",", '"', "\n"]

  constructor(private readonly storageService: IStorageService) {}

  async exportToCSV(commits: AnalyzedCommit[], filePath: string): Promise<void> {
    const csvContent = this.generateCSV(commits)
    await this.storageService.writeFile(filePath, csvContent)
  }

  async importFromCSV(filePath: string): Promise<AnalyzedCommit[]> {
    const content = await this.storageService.readFile(filePath)
    return this.parseCSV(content)
  }

  private generateCSV(commits: AnalyzedCommit[]): string {
    const rows = commits.map((commit) => this.formatRow(commit))
    return [CSVExporter.CSV_HEADERS, ...rows].join("\n")
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
    return CSVExporter.CSV_SPECIAL_CHARS.some(char => field.includes(char))
  }

  private escapeAndQuoteField(field: string): string {
    return `"${field.replace(/"/g, '""')}"`
  }

  private parseCSV(content: string): AnalyzedCommit[] {
    // This is a simplified CSV parser - in a real implementation,
    // you'd want to use a proper CSV parsing library
    const lines = content.split("\n").filter(line => line.trim().length > 0)
    
    if (lines.length < 2) {
      throw new Error("Invalid CSV format: no data rows found")
    }

    // Skip header row
    const dataRows = lines.slice(1)
    const commits: AnalyzedCommit[] = []

    for (const row of dataRows) {
      try {
        const commit = this.parseCSVRow(row)
        commits.push(commit)
      } catch (error) {
        console.warn(`Warning: Failed to parse CSV row: ${row}`)
        console.warn(`Error: ${error}`)
      }
    }

    return commits
  }

  private parseCSVRow(row: string): AnalyzedCommit {
    // This is a simplified parser - a real implementation would handle
    // quoted fields with commas properly
    const fields = row.split(",").map(field => field.trim())
    
    if (fields.length < 4) {
      throw new Error("Invalid CSV row: insufficient fields")
    }

    // For now, this method is a placeholder
    // In a real implementation, you'd need to reconstruct the full
    // AnalyzedCommit object from the CSV data
    throw new Error("CSV import not yet implemented - requires full commit reconstruction")
  }
}