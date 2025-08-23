import { execSync } from "child_process"
import { CommitInfo, LLMAnalysis } from "./types"

export class LLMService {
  private static model: string

  /**
   * Detect available LLM models by checking CLI commands.
   */
  static detectAvailableModels(): string[] {
    const models = ["claude", "gemini", "codex"]
    return models.filter((model) => {
      try {
        execSync(`command -v ${model}`, { stdio: "ignore" })
        return true
      } catch {
        return false
      }
    })
  }

  /**
   * Determine default LLM model based on availability.
   */
  static detectDefaultModel(): string {
    const available = this.detectAvailableModels()
    if (available.length === 0) {
      throw new Error(
        "No supported LLM models found. Please install claude, gemini, or codex.",
      )
    }
    return available[0]
  }

  /**
   * Set the LLM model command to use.
   */
  static setModel(model: string): void {
    this.model = model
  }

  /**
   * Get the configured LLM model or detect default.
   */
  static getModel(): string {
    if (!this.model) {
      this.model = this.detectDefaultModel()
    }
    return this.model
  }
  private static readonly MAX_RETRIES = parseInt(
    process.env.LLM_MAX_RETRIES || "3",
    10,
  )
  private static readonly INITIAL_RETRY_DELAY = parseInt(
    process.env.LLM_INITIAL_RETRY_DELAY || "5000",
    10,
  )
  private static readonly MAX_RETRY_DELAY = parseInt(
    process.env.LLM_MAX_RETRY_DELAY || "30000",
    10,
  )
  private static readonly RETRY_MULTIPLIER = parseFloat(
    process.env.LLM_RETRY_MULTIPLIER || "2",
  )

  static async analyzeCommit(commit: CommitInfo): Promise<LLMAnalysis> {
    const prompt = this.buildPrompt(commit.message, commit.diff)

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const modelCmd = this.getModel()
        const output = execSync(modelCmd, {
          input: prompt,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 60000,
        })

        return this.parseResponse(output)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error")

        if (attempt < this.MAX_RETRIES) {
          const delay = Math.min(
            this.INITIAL_RETRY_DELAY *
              Math.pow(this.RETRY_MULTIPLIER, attempt - 1),
            this.MAX_RETRY_DELAY,
          )

          console.log(
            `  - Attempt ${attempt}/${this.MAX_RETRIES} failed for commit ${commit.hash.substring(0, 8)}. Retrying in ${delay / 1000}s...`,
          )

          await this.sleep(delay)
        }
      }
    }

    throw new Error(
      `Failed to analyze commit ${commit.hash} after ${this.MAX_RETRIES} attempts: ${lastError?.message || "Unknown error"}`,
    )
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  static getMaxRetries(): number {
    return this.MAX_RETRIES
  }

  private static buildPrompt(commitMessage: string, diff: string): string {
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

  private static parseResponse(response: string): LLMAnalysis {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      if (!jsonMatch) {
        throw new Error("No JSON block found in response")
      }

      const parsed = JSON.parse(jsonMatch[1])

      if (!this.isValidCategory(parsed.category)) {
        throw new Error(`Invalid category: ${parsed.category}`)
      }

      if (!parsed.summary || !parsed.description) {
        throw new Error("Missing required fields in response")
      }

      return {
        category: parsed.category,
        summary: parsed.summary.substring(0, 80),
        description: parsed.description,
      }
    } catch (error) {
      throw new Error(
        `Failed to parse LLM response: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  private static isValidCategory(
    category: string,
  ): category is "tweak" | "feature" | "process" {
    return ["tweak", "feature", "process"].includes(category)
  }
}
