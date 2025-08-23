import { writeFileSync } from "fs"
import { CSVReaderService, ParsedCSVRow } from "./csv-reader"
import { LLMService } from "./llm"

export class MarkdownReportGenerator {
  /**
   * Generate a markdown report from CSV data
   */
  static async generateReport(
    csvFilePath: string,
    outputPath: string,
  ): Promise<void> {
    console.log(`Reading CSV data from ${csvFilePath}...`)

    // Read and parse CSV data
    const csvData = CSVReaderService.readCSV(csvFilePath)

    if (csvData.length === 0) {
      throw new Error("No data found in CSV file")
    }

    // Get statistics for logging
    const stats = CSVReaderService.getStatistics(csvData)
    console.log(
      `Found ${stats.totalRows} commits spanning ${stats.yearRange.min}-${stats.yearRange.max}`,
    )
    console.log(
      `Categories: ${stats.categoryBreakdown.feature} features, ${stats.categoryBreakdown.process} process, ${stats.categoryBreakdown.tweak} tweaks`,
    )

    console.log("Generating condensed report...")

    // Generate commit analysis section programmatically
    const analysisSection = this.generateAnalysisSection(csvData)

    // Convert CSV data to string format for LLM (for content summarization only)
    const csvContent = this.convertToCSVString(csvData)

    // Generate detailed yearly summaries using LLM
    const yearlyContent = await this.generateYearlySummariesWithLLM(csvContent)

    // Combine analysis section with LLM-generated content
    const reportContent = `# Development Summary Report\n\n${analysisSection}\n\n${yearlyContent}`

    // Write to output file
    writeFileSync(outputPath, reportContent, "utf8")

    console.log(`Report generated: ${outputPath}`)
  }

  /**
   * Convert parsed CSV data back to CSV string format for LLM consumption
   */
  private static convertToCSVString(data: ParsedCSVRow[]): string {
    const header = "year,category,summary,description"
    const rows = data.map((row) =>
      [
        row.year,
        this.escapeCsvField(row.category),
        this.escapeCsvField(row.summary),
        this.escapeCsvField(row.description),
      ].join(","),
    )

    return [header, ...rows].join("\n")
  }

  /**
   * Escape CSV fields that contain commas, quotes, or newlines
   */
  private static escapeCsvField(field: string): string {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }

  /**
   * Generate commit analysis section with accurate counts
   */
  private static generateAnalysisSection(csvData: ParsedCSVRow[]): string {
    const stats = CSVReaderService.getStatistics(csvData)

    // Group data by year for detailed breakdown
    const yearlyStats = csvData.reduce(
      (acc, row) => {
        if (!acc[row.year]) {
          acc[row.year] = { tweak: 0, feature: 0, process: 0, total: 0 }
        }
        acc[row.year][row.category]++
        acc[row.year].total++
        return acc
      },
      {} as Record<
        number,
        { tweak: number; feature: number; process: number; total: number }
      >,
    )

    // Sort years in descending order
    const sortedYears = Object.keys(yearlyStats)
      .map(Number)
      .sort((a, b) => b - a)

    let analysisContent = `## Commit Analysis\n`
    analysisContent += `- **Total Commits**: ${stats.totalRows} commits across ${stats.yearRange.min}-${stats.yearRange.max}\n`

    // Add year-by-year breakdown
    for (const year of sortedYears) {
      const yearData = yearlyStats[year]
      analysisContent += `- **${year}**: ${yearData.total} commits (${yearData.feature} features, ${yearData.process} process, ${yearData.tweak} tweaks)\n`
    }

    return analysisContent
  }

  /**
   * Generate yearly summaries using LLM service
   */
  private static async generateYearlySummariesWithLLM(
    csvContent: string,
  ): Promise<string> {
    const prompt = this.buildReportPrompt(csvContent)

    try {
      // Use the same retry logic as commit analysis
      const response = await this.callLLMWithRetry(prompt)
      return this.parseReportResponse(response)
    } catch (error) {
      throw new Error(
        `Failed to generate report: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  /**
   * Build the prompt for report generation based on the template
   */
  private static buildReportPrompt(csvContent: string): string {
    return `Analyze the following CSV data containing git commit analysis results and generate a condensed markdown development summary report.

CSV DATA:
${csvContent}

INSTRUCTIONS:
1. Group the data by year (descending order, most recent first)
2. Within each year, group by category: Features, Process Improvements, and Tweaks & Bug Fixes
3. Consolidate similar items within each category to create readable summaries
4. Focus on what was accomplished rather than individual commit details
5. Use clear, professional language appropriate for stakeholders

CATEGORY MAPPING:
- "feature" → "Features" section
- "process" → "Processes" section  
- "tweak" → "Tweaks & Bug Fixes" section

CONSOLIDATION GUIDELINES:
- Group similar features together (e.g., "authentication system improvements")
- Combine related bug fixes (e.g., "resolved 8 authentication issues")
- Summarize process changes by theme (e.g., "CI/CD pipeline enhancements")
- Use bullet points for individual items within categories
- Aim for 3-7 bullet points per category per year
- Include specific numbers when relevant (e.g., "15 bug fixes", "3 new features")

OUTPUT FORMAT:
Generate yearly summary sections with this exact structure (DO NOT include the main title or commit analysis section):

\`\`\`markdown
## [YEAR]
### Features
- [Consolidated feature summary 1]
- [Consolidated feature summary 2]
- [Additional features as needed]

### Processes
- [Consolidated process improvement 1]
- [Consolidated process improvement 2]
- [Additional process items as needed]

### Tweaks & Bug Fixes
- [Consolidated tweak/fix summary 1]
- [Consolidated tweak/fix summary 2]
- [Additional tweaks/fixes as needed]

## [PREVIOUS YEAR]
[Repeat structure for each year in the data]
\`\`\`

QUALITY REQUIREMENTS:
- Keep summaries concise but informative
- Use active voice and clear language
- Avoid technical jargon where possible
- Ensure each bullet point represents meaningful work
- Make the report valuable for both technical and non-technical readers

Generate the markdown report now:`
  }

  /**
   * Call LLM with retry logic similar to commit analysis
   */
  private static async callLLMWithRetry(prompt: string): Promise<string> {
    const maxRetries = LLMService.getMaxRetries()
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Create a mock commit object for the LLM service
        const mockCommit = {
          hash: "report-generation",
          message: "Generate report from CSV data",
          date: new Date(),
          diff: prompt,
          year: new Date().getFullYear(),
        }

        // Use the existing LLM service but intercept the response
        const { execSync } = require("child_process")
        const currentModel = LLMService.getModel()

        console.log(`  - Using model: ${currentModel}`)
        console.log(
          `  - Processing ${prompt.split("\n").length} lines of CSV data`,
        )

        const output = execSync(currentModel, {
          input: prompt,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 120000, // Longer timeout for report generation
        })

        return output.trim()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error")

        console.log(`  - Error generating report:`)
        console.log(`    Attempt: ${attempt}/${maxRetries}`)
        console.log(`    Error: ${lastError.message}`)

        if (attempt < maxRetries) {
          const delay = Math.min(5000 * Math.pow(2, attempt - 1), 30000)
          console.log(`    Retrying in ${delay / 1000}s...`)
          await this.sleep(delay)
        }
      }
    }

    throw new Error(
      `Failed to generate report after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`,
    )
  }

  /**
   * Parse the LLM response to extract the yearly summary content
   */
  private static parseReportResponse(response: string): string {
    // Look for markdown block first
    const markdownMatch = response.match(/```markdown\s*([\s\S]*?)\s*```/)
    if (markdownMatch) {
      return markdownMatch[1].trim()
    }

    // If no markdown block, look for content starting with "##" (yearly sections)
    const yearSectionMatch = response.match(/^(##\s+\d{4}[\s\S]*)/m)
    if (yearSectionMatch) {
      return yearSectionMatch[1].trim()
    }

    // If no clear structure found, return the entire response but log a warning
    console.log(
      "  - Warning: Could not find structured yearly sections in LLM response",
    )
    console.log(`  - Response preview: ${response.substring(0, 200)}...`)

    return response.trim()
  }

  /**
   * Sleep utility for retry delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

