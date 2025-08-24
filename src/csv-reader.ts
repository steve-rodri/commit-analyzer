import { readFileSync } from "fs"

export interface ParsedCSVRow {
  year: number
  category: "tweak" | "feature" | "process"
  summary: string
  description: string
}

export class CSVReaderService {
  static readCSV(filename: string): ParsedCSVRow[] {
    try {
      const content = readFileSync(filename, "utf8")
      return this.parseCSV(content)
    } catch (error) {
      throw new Error(
        `Failed to read CSV file ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  private static parseCSV(content: string): ParsedCSVRow[] {
    const lines = content.trim().split("\n")

    if (lines.length === 0) {
      throw new Error("CSV file is empty")
    }

    // Validate header
    const header = lines[0].toLowerCase()
    const expectedHeader = "year,category,summary,description"
    if (header !== expectedHeader) {
      throw new Error(
        `Invalid CSV format. Expected header: "${expectedHeader}", got: "${header}"`,
      )
    }

    const rows: ParsedCSVRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line === "") continue // Skip empty lines

      try {
        const row = this.parseCSVLine(line)
        rows.push(row)
      } catch (error) {
        throw new Error(
          `Error parsing CSV line ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`,
        )
      }
    }

    return rows
  }

  private static parseCSVLine(line: string): ParsedCSVRow {
    const fields = this.parseCSVFields(line)

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

    return {
      year,
      category: category as "tweak" | "feature" | "process",
      summary: summary.trim(),
      description: description.trim(),
    }
  }

  /**
   * Parse CSV fields handling quoted fields with commas and escaped quotes
   */
  private static parseCSVFields(line: string): string[] {
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

  private static isValidCategory(
    category: string,
  ): category is "tweak" | "feature" | "process" {
    return ["tweak", "feature", "process"].includes(category)
  }

  /**
   * Get summary statistics about the CSV data
   */
  static getStatistics(rows: ParsedCSVRow[]): {
    totalRows: number
    yearRange: { min: number; max: number }
    categoryBreakdown: Record<string, number>
  } {
    if (rows.length === 0) {
      return {
        totalRows: 0,
        yearRange: { min: 0, max: 0 },
        categoryBreakdown: { tweak: 0, feature: 0, process: 0 },
      }
    }

    const years = rows.map((row) => row.year)
    const categoryBreakdown = rows.reduce(
      (acc, row) => {
        acc[row.category]++
        return acc
      },
      { tweak: 0, feature: 0, process: 0 } as Record<string, number>,
    )

    return {
      totalRows: rows.length,
      yearRange: {
        min: Math.min(...years),
        max: Math.max(...years),
      },
      categoryBreakdown,
    }
  }
}

