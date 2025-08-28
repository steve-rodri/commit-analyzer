import { CategoryType } from "@domain/category"

import { ILLMService } from "@app/llm-service"

import { sleep } from "../utils"

export abstract class LLMAdapter implements ILLMService {
  protected static readonly DEFAULT_TIMEOUT = 60000
  protected static readonly MAX_RETRIES = parseInt(
    process.env.LLM_MAX_RETRIES || "3",
    10,
  )
  protected static readonly INITIAL_RETRY_DELAY = parseInt(
    process.env.LLM_INITIAL_RETRY_DELAY || "5000",
    10,
  )
  protected static readonly MAX_RETRY_DELAY = parseInt(
    process.env.LLM_MAX_RETRY_DELAY || "30000",
    10,
  )
  protected static readonly RETRY_MULTIPLIER = parseFloat(
    process.env.LLM_RETRY_MULTIPLIER || "2",
  )

  protected model: string = ""
  protected verbose: boolean = false
  protected retryEnabled: boolean = true

  protected abstract getMaxPromptLength(): number

  abstract detectAvailableModels(): Promise<string[]>
  abstract isAvailable(): Promise<boolean>
  protected abstract executeModelCommand(prompt: string): Promise<string>

  setLLM(llm: string): void {
    this.model = llm
  }

  // Deprecated: Use setLLM instead
  setModel(model: string): void {
    this.setLLM(model)
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose
  }

  setRetryEnabled(enabled: boolean): void {
    this.retryEnabled = enabled
  }

  getMaxRetries(): number {
    return LLMAdapter.MAX_RETRIES
  }

  async analyzeCommit(
    message: string,
    diff: string,
  ): Promise<{
    category: CategoryType
    summary: string
    description: string
  }> {
    const prompt = this.buildPrompt(message, diff)
    let lastError: Error | null = null

    if (!this.retryEnabled) {
      try {
        const output = await this.executeModelCommand(prompt)
        return this.parseResponse(output)
      } catch (error) {
        throw new Error(
          `Failed to analyze commit: ${error instanceof Error ? error.message : "Unknown error"}`,
        )
      }
    }

    for (let attempt = 1; attempt <= LLMAdapter.MAX_RETRIES; attempt++) {
      try {
        const output = await this.executeModelCommand(prompt)
        return this.parseResponse(output)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error")

        if (attempt < LLMAdapter.MAX_RETRIES) {
          const delay = Math.min(
            LLMAdapter.INITIAL_RETRY_DELAY *
              Math.pow(LLMAdapter.RETRY_MULTIPLIER, attempt - 1),
            LLMAdapter.MAX_RETRY_DELAY,
          )

          if (this.verbose) {
            console.log(
              `  - Attempt ${attempt}/${LLMAdapter.MAX_RETRIES} failed. Retrying in ${delay / 1000}s...`,
            )
          }

          await sleep(delay)
        }
      }
    }

    throw new Error(
      `Failed to analyze commit after ${LLMAdapter.MAX_RETRIES} attempts: ${lastError?.message || "Unknown error"}`,
    )
  }

  protected buildPrompt(commitMessage: string, diff: string): string {
    return `Analyze this git commit and provide a categorization.

COMMIT MESSAGE:
${commitMessage}

COMMIT DIFF:
${diff}

Based on the commit message and code changes, categorize this commit as one of:
- "tweak": Minor adjustments, bug fixes, small improvements
- "feature": New functionality, major additions  
- "process": Build system, CI/CD, tooling, configuration changes

IMPORTANT: You must respond with ONLY a valid JSON object in this exact format:

\`\`\`json
{
  "category": "tweak|feature|process",
  "summary": "One-line description (max 80 characters)",
  "description": "Detailed explanation in 2-3 sentences"
}
\`\`\`

Do not include any other text outside the JSON code block.`
  }

  protected parseResponse(response: string): {
    category: CategoryType
    summary: string
    description: string
  } {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      if (!jsonMatch) {
        throw new Error("No JSON block found in response")
      }

      const jsonString = jsonMatch[1].trim()
      const parsed = JSON.parse(jsonString)

      const { category, summary, description } = parsed

      if (!this.isValidCategory(category)) {
        throw new Error(`Invalid category: ${category}`)
      }

      if (!summary || !description) {
        throw new Error("Missing required fields in response")
      }

      return {
        category: category as CategoryType,
        summary: summary.substring(0, 80), // Ensure max length
        description: description,
      }
    } catch (error) {
      if (this.verbose) {
        console.log(
          `  - Raw LLM response (first 2000 chars): ${response.substring(0, 2000)}`,
        )
        if (response.length > 2000) {
          console.log(
            `  - Response truncated (total length: ${response.length} chars)`,
          )
        }
      }

      throw new Error(
        `Failed to parse LLM response: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  protected isValidCategory(category: string): category is CategoryType {
    return ["tweak", "feature", "process"].includes(category)
  }

  async generateYearlySummariesFromCSV(csvContent: string): Promise<string> {
    return this.generateTimePeriodSummariesFromCSV(csvContent, 'yearly')
  }

  async generateTimePeriodSummariesFromCSV(csvContent: string, period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'): Promise<string> {
    const prompt = this.buildTimePeriodReportPrompt(csvContent, period)
    let lastError: Error | null = null

    if (!this.retryEnabled) {
      try {
        const output = await this.executeModelCommand(prompt)
        return this.parseReportResponse(output)
      } catch (error) {
        throw new Error(
          `Failed to generate report: ${error instanceof Error ? error.message : "Unknown error"}`,
        )
      }
    }

    for (let attempt = 1; attempt <= LLMAdapter.MAX_RETRIES; attempt++) {
      try {
        const output = await this.executeModelCommand(prompt)
        return this.parseReportResponse(output)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error")

        if (this.verbose) {
          console.log(`  - Error generating report:`)
          console.log(`    Attempt: ${attempt}/${LLMAdapter.MAX_RETRIES}`)
          console.log(`    Error: ${lastError.message}`)
        }

        if (attempt < LLMAdapter.MAX_RETRIES) {
          const delay = Math.min(
            LLMAdapter.INITIAL_RETRY_DELAY *
              Math.pow(LLMAdapter.RETRY_MULTIPLIER, attempt - 1),
            LLMAdapter.MAX_RETRY_DELAY,
          )
          if (this.verbose) {
            console.log(`    Retrying in ${delay / 1000}s...`)
          }
          await sleep(delay)
        }
      }
    }

    throw new Error(
      `Failed to generate report after ${LLMAdapter.MAX_RETRIES} attempts: ${lastError?.message || "Unknown error"}`,
    )
  }

  private buildReportPrompt(csvContent: string): string {
    return `Analyze the following CSV data containing git commit analysis results and generate a condensed markdown development summary report.

CSV DATA:
${csvContent}

INSTRUCTIONS:
1. Group the data by year (descending order, most recent first)
2. Within each year, group by category: Features, Process Improvements, and Tweaks & Bug Fixes
3. Use the 'commit_count' and 'date_range' columns to understand the scope and timeline of work
4. Consolidate similar items within each category to create readable summaries
5. Focus on what was accomplished rather than individual commit details
6. Use clear, professional language appropriate for stakeholders
7. Pay attention to recurring themes and patterns across commits

CATEGORY MAPPING:
- "feature" → "Features" section
- "process" → "Processes" section  
- "tweak" → "Tweaks & Bug Fixes" section

CONSOLIDATION GUIDELINES:
- FIRST: Extract common themes and keywords from commit summaries within each category
- SECOND: Identify and merge duplicate or highly similar work items (e.g., multiple "fix auth bug" commits become "resolved authentication issues")
- Group similar features together by theme (e.g., "authentication system improvements", "payment processing enhancements")
- Combine related bug fixes by area/system (e.g., "resolved 8 authentication issues", "fixed 5 database connection problems")
- Summarize process changes by theme (e.g., "CI/CD pipeline enhancements", "testing infrastructure improvements")
- Use bullet points for individual consolidated items within categories
- Aim for 3-7 bullet points per category per year
- Include specific numbers when relevant (e.g., "15 bug fixes", "3 new features")
- Avoid listing near-identical items separately - consolidate them into meaningful groups

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
- Focus on business impact and user value rather than technical implementation details
- When consolidating, preserve the most important aspects from similar commits
- Use progressive disclosure: start with high-level themes, then add specific details

CONTEXT ANALYSIS:
Before consolidating, analyze the commit data for:
1. Common file patterns or system areas being modified
2. Recurring keywords in commit messages that indicate related work
3. Sequential commits that build upon each other
4. Bug fixes that address the same underlying issue

Generate the markdown report now:`
  }

  private buildTimePeriodReportPrompt(csvContent: string, period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'): string {
    const periodDisplayName = this.getPeriodDisplayName(period)
    const sectionHeader = this.getSectionHeader(period)
    
    return `Analyze the following CSV data containing git commit analysis results and generate a condensed markdown development summary report.

CSV DATA:
${csvContent}

INSTRUCTIONS:
1. Group the data by ${periodDisplayName} (descending order, most recent first)
2. Within each ${periodDisplayName.toLowerCase()}, group by category: Features, Process Improvements, and Tweaks & Bug Fixes
3. Use the 'commit_count' and 'similar_commits' columns to understand related work and consolidation opportunities
4. Consolidate similar items within each category to create readable summaries
5. Focus on what was accomplished rather than individual commit details
6. Use clear, professional language appropriate for stakeholders
7. Only include sections for time periods that have commits
8. Pay attention to recurring themes and patterns across commits

CATEGORY MAPPING:
- "feature" → "Features" section
- "process" → "Processes" section  
- "tweak" → "Tweaks & Bug Fixes" section

CONSOLIDATION GUIDELINES:
- FIRST: Extract common themes and keywords from commit summaries within each category
- SECOND: Identify and merge duplicate or highly similar work items (e.g., multiple "fix auth bug" commits become "resolved authentication issues")
- Group similar features together by theme (e.g., "authentication system improvements", "payment processing enhancements")
- Combine related bug fixes by area/system (e.g., "resolved 8 authentication issues", "fixed 5 database connection problems")
- Summarize process changes by theme (e.g., "CI/CD pipeline enhancements", "testing infrastructure improvements")
- Use bullet points for individual consolidated items within categories
- Aim for 3-7 bullet points per category per ${periodDisplayName.toLowerCase()}
- Include specific numbers when relevant (e.g., "15 bug fixes", "3 new features")
- Avoid listing near-identical items separately - consolidate them into meaningful groups

OUTPUT FORMAT:
Generate ${periodDisplayName.toLowerCase()} summary sections with this exact structure (DO NOT include the main title or commit analysis section):

\`\`\`markdown
${sectionHeader}
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

${this.getPreviousPeriodExample(period)}
[Repeat structure for each ${periodDisplayName.toLowerCase()} in the data]
\`\`\`

QUALITY REQUIREMENTS:
- Keep summaries concise but informative
- Use active voice and clear language
- Avoid technical jargon where possible
- Ensure each bullet point represents meaningful work
- Make the report valuable for both technical and non-technical readers
- Focus on business impact and user value rather than technical implementation details
- When consolidating, preserve the most important aspects from similar commits
- Use progressive disclosure: start with high-level themes, then add specific details

CONTEXT ANALYSIS:
Before consolidating, analyze the commit data for:
1. Common file patterns or system areas being modified
2. Recurring keywords in commit messages that indicate related work
3. Sequential commits that build upon each other
4. Bug fixes that address the same underlying issue

Generate the markdown report now:`
  }

  private getPeriodDisplayName(period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'): string {
    switch (period) {
      case 'daily': return 'Daily Period'
      case 'weekly': return 'Week'
      case 'monthly': return 'Month'
      case 'quarterly': return 'Quarter'
      case 'yearly': return 'Year'
    }
  }

  private getSectionHeader(period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'): string {
    switch (period) {
      case 'daily': return '## [DATE] [TIME_OF_DAY]'
      case 'weekly': return '## [WEEK_RANGE]'
      case 'monthly': return '## [MONTH] [YEAR]'
      case 'quarterly': return '## [QUARTER] [YEAR]'
      case 'yearly': return '## [YEAR]'
    }
  }

  private getPreviousPeriodExample(period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'): string {
    switch (period) {
      case 'daily': return '## [PREVIOUS_DATE] [TIME_OF_DAY]'
      case 'weekly': return '## [PREVIOUS_WEEK_RANGE]'
      case 'monthly': return '## [PREVIOUS_MONTH] [YEAR]'
      case 'quarterly': return '## [PREVIOUS_QUARTER] [YEAR]'
      case 'yearly': return '## [PREVIOUS_YEAR]'
    }
  }

  private parseReportResponse(response: string): string {
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
    if (this.verbose) {
      console.log(
        "  - Warning: Could not find structured yearly sections in LLM response",
      )
      console.log(`  - Response preview: ${response.substring(0, 200)}...`)
    }

    return response.trim()
  }

  protected truncatePrompt(prompt: string): string {
    const maxLength = this.getMaxPromptLength()
    if (prompt.length <= maxLength) {
      return prompt
    }

    // Find the diff section and truncate it
    const diffStartIndex = prompt.indexOf("COMMIT DIFF:")
    if (diffStartIndex === -1) {
      return prompt
    }

    const beforeDiff = prompt.substring(0, diffStartIndex)
    const afterDiffHeader = prompt.substring(diffStartIndex)
    const diffHeaderEnd = afterDiffHeader.indexOf("\n") + 1
    const diffHeader = afterDiffHeader.substring(0, diffHeaderEnd)
    const diffContent = afterDiffHeader.substring(diffHeaderEnd)

    // Calculate how much space we have for the diff
    const overhead = beforeDiff.length + diffHeader.length + 500 // Leave some buffer
    const maxDiffLength = Math.max(1000, maxLength - overhead)

    if (diffContent.length > maxDiffLength) {
      const truncatedDiff = diffContent.substring(0, maxDiffLength)
      const truncationNotice =
        "\n\n[DIFF TRUNCATED - Original length: " +
        diffContent.length +
        " characters]"

      return (
        beforeDiff +
        diffHeader +
        truncatedDiff +
        truncationNotice +
        "\n\nBased on the commit message and code changes, categorize this commit..."
      )
    }

    return prompt
  }
}
