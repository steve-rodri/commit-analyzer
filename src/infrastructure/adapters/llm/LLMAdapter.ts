import { ILLMService } from "../../../application/ports/out/ILLMService"
import { CategoryType } from "../../../domain/value-objects/Category"
import { sleep } from "../../../utils"

/**
 * Base LLM adapter with common functionality
 */
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

  abstract detectAvailableModels(): Promise<string[]>
  abstract isAvailable(): Promise<boolean>
  protected abstract executeModelCommand(prompt: string): Promise<string>

  setModel(model: string): void {
    this.model = model
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose
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
    return `Analyze this git commit and provide a categorization:

    COMMIT MESSAGE:
    ${commitMessage}

    COMMIT DIFF:
    ${diff}

    Based on the commit message and code changes, categorize this commit as one of:
    - "tweak": Minor adjustments, bug fixes, small improvements
    - "feature": New functionality, major additions
    - "process": Build system, CI/CD, tooling, configuration changes

    Provide:
    1. Category: [tweak|feature|process]
    2. Summary: One-line description (max 80 chars)
    3. Description: Detailed explanation (2-3 sentences)

    Format as JSON:
    \`\`\`json
    {
      "category": "...",
      "summary": "...",
      "description": "..."
    }
    \`\`\``
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
          `  - Raw LLM response (first 1000 chars): ${response.substring(0, 1000)}`,
        )
        if (response.length > 1000) {
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
}

