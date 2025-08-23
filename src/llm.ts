import { execSync } from "child_process"
import { CommitInfo, LLMAnalysis } from "./types"

export class LLMService {
  private static model: string
  private static verbose: boolean = false

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
    // Default to sonnet if claude is available
    if (available.includes('claude')) {
      return 'claude --model sonnet'
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
   * Set verbose mode for detailed error logging.
   */
  static setVerbose(verbose: boolean): void {
    this.verbose = verbose
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
  // Claude-specific configuration with backward compatibility
  private static readonly CLAUDE_MAX_PROMPT_LENGTH = parseInt(
    process.env.CLAUDE_MAX_PROMPT_LENGTH || process.env.LLM_MAX_PROMPT_LENGTH || "100000",
    10,
  )
  private static readonly CLAUDE_MAX_DIFF_LENGTH = parseInt(
    process.env.CLAUDE_MAX_DIFF_LENGTH || process.env.LLM_MAX_DIFF_LENGTH || "80000",
    10,
  )

  static async analyzeCommit(commit: CommitInfo): Promise<LLMAnalysis> {
    const currentModel = this.getModel()
    const prompt = this.buildPrompt(commit.message, commit.diff, currentModel)
    
    // Log prompt length for debugging - only for Claude models
    if (this.isClaudeModel(currentModel)) {
      console.log(`  - Prompt length: ${prompt.length} characters`)
      if (prompt.length > this.CLAUDE_MAX_PROMPT_LENGTH) {
        console.log(`  - Warning: Prompt exceeds Claude max length (${this.CLAUDE_MAX_PROMPT_LENGTH})`)
      }
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const output = execSync(currentModel, {
          input: prompt,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 60000,
        })

        return this.parseResponse(output)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error")
        
        // Check if this is a rate limit error
        const rateLimitInfo = this.isRateLimitError(error)
        
        if (rateLimitInfo.isRateLimit) {
          // For rate limits, show user-friendly message immediately
          const friendlyMessage = this.getRateLimitMessage(rateLimitInfo.service, rateLimitInfo.limitType)
          console.log(`  - ${friendlyMessage}`)
          
          // Show detailed error info only in verbose mode
          if (this.verbose) {
            console.log(`  - Verbose error details for commit ${commit.hash.substring(0, 8)}:`)
            console.log(`    Command: ${currentModel}`)
            console.log(`    Error message: ${lastError.message}`)
            if (this.isClaudeModel(currentModel)) {
              console.log(`    Prompt length: ${prompt.length} characters`)
            }
            
            // If it's an exec error, log additional details
            if (error && typeof error === 'object' && 'stderr' in error) {
              const execError = error as any
              console.log(`    Exit code: ${execError.status || 'unknown'}`)
              console.log(`    Signal: ${execError.signal || 'none'}`)
              if (execError.stderr) {
                console.log(`    Stderr: ${execError.stderr.substring(0, 1000)}${execError.stderr.length > 1000 ? '...' : ''}`)
              }
            }
          }
          
          // If it's a daily quota error, don't retry - fail immediately
          if (rateLimitInfo.limitType === "daily quota") {
            throw new Error(
              `Daily quota exceeded for ${rateLimitInfo.service || 'LLM service'}. Retrying will not help until quota resets.`,
            )
          }
        } else {
          // For non-rate-limit errors, show detailed info based on verbose mode
          if (this.verbose) {
            console.log(`  - Error details for commit ${commit.hash.substring(0, 8)}:`)
            console.log(`    Command: ${currentModel}`)
            console.log(`    Error message: ${lastError.message}`)
            if (this.isClaudeModel(currentModel)) {
              console.log(`    Prompt length: ${prompt.length} characters`)
            }
            
            // If it's an exec error, log additional details
            if (error && typeof error === 'object' && 'stderr' in error) {
              const execError = error as any
              console.log(`    Exit code: ${execError.status || 'unknown'}`)
              console.log(`    Signal: ${execError.signal || 'none'}`)
              console.log(`    Stderr: ${execError.stderr || 'none'}`)
              console.log(`    Stdout: ${execError.stdout || 'none'}`)
            }
          } else {
            // In non-verbose mode, show concise error message
            console.log(`  - Analysis failed: ${lastError.message}`)
          }
        }

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

  /**
   * Check if the current model is Claude-based
   */
  private static isClaudeModel(model?: string): boolean {
    const currentModel = model || this.getModel()
    return currentModel.toLowerCase().includes('claude')
  }

  private static buildPrompt(commitMessage: string, diff: string, model: string): string {
    // Only truncate for Claude models
    let truncatedDiff = diff
    let diffTruncated = false
    
    if (this.isClaudeModel(model) && diff.length > this.CLAUDE_MAX_DIFF_LENGTH) {
      truncatedDiff = diff.substring(0, this.CLAUDE_MAX_DIFF_LENGTH) + "\n\n[DIFF TRUNCATED - Original length: " + diff.length + " characters]"
      diffTruncated = true
    }
    
    const basePrompt = `Analyze this git commit and provide a categorization:

COMMIT MESSAGE:
${commitMessage}

COMMIT DIFF:
${truncatedDiff}

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

    // Final length check - only for Claude models
    if (this.isClaudeModel(model) && basePrompt.length > this.CLAUDE_MAX_PROMPT_LENGTH) {
      // Further truncate the diff if needed
      const overhead = basePrompt.length - this.CLAUDE_MAX_PROMPT_LENGTH
      const newDiffLength = Math.max(1000, this.CLAUDE_MAX_DIFF_LENGTH - overhead - 200) // Keep at least 1000 chars, subtract extra for safety
      truncatedDiff = diff.substring(0, newDiffLength) + "\n\n[DIFF HEAVILY TRUNCATED - Original length: " + diff.length + " characters]"
      
      return `Analyze this git commit and provide a categorization:

COMMIT MESSAGE:
${commitMessage}

COMMIT DIFF:
${truncatedDiff}

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
    
    return basePrompt
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
      // Log the raw response for debugging
      console.log(`  - Raw LLM response (first 1000 chars): ${response.substring(0, 1000)}`)
      if (response.length > 1000) {
        console.log(`  - Response truncated (total length: ${response.length} chars)`)
      }
      
      // Try to extract and log the JSON block if it exists but is malformed
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        console.log(`  - Extracted JSON block: ${jsonMatch[1]}`)
      }
      
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

  /**
   * Check if an error is related to rate limiting or quota exceeded.
   */
  private static isRateLimitError(error: any): { isRateLimit: boolean; service?: string; limitType?: string } {
    const errorMessage = error?.message?.toLowerCase() || ""
    const stderr = error?.stderr?.toLowerCase() || ""
    const stdout = error?.stdout?.toLowerCase() || ""
    const combinedOutput = `${errorMessage} ${stderr} ${stdout}`

    // Check for Gemini rate limit patterns
    if (combinedOutput.includes("quota exceeded") && combinedOutput.includes("gemini")) {
      if (combinedOutput.includes("requests per day")) {
        return { isRateLimit: true, service: "Gemini", limitType: "daily quota" }
      }
      if (combinedOutput.includes("requests per minute")) {
        return { isRateLimit: true, service: "Gemini", limitType: "per-minute rate limit" }
      }
      return { isRateLimit: true, service: "Gemini", limitType: "quota limit" }
    }

    // Check for Claude rate limit patterns
    if (combinedOutput.includes("rate limit") && combinedOutput.includes("claude")) {
      return { isRateLimit: true, service: "Claude", limitType: "rate limit" }
    }

    // Check for generic rate limit indicators
    if (combinedOutput.includes("429") || 
        combinedOutput.includes("too many requests") ||
        combinedOutput.includes("rate limit") ||
        combinedOutput.includes("quota exceeded")) {
      // Try to determine service from model name
      const currentModel = this.getModel().toLowerCase()
      if (currentModel.includes("gemini")) {
        return { isRateLimit: true, service: "Gemini", limitType: "rate/quota limit" }
      }
      if (currentModel.includes("claude")) {
        return { isRateLimit: true, service: "Claude", limitType: "rate limit" }
      }
      return { isRateLimit: true, limitType: "rate/quota limit" }
    }

    return { isRateLimit: false }
  }

  /**
   * Get user-friendly error message for rate limit errors.
   */
  private static getRateLimitMessage(service?: string, limitType?: string): string {
    if (service === "Gemini" && limitType === "daily quota") {
      return "⚠️  Gemini daily quota exceeded. The limit resets at midnight Pacific Time. Consider switching to a different model or resuming tomorrow."
    }
    
    if (service === "Gemini" && limitType === "per-minute rate limit") {
      return "⚠️  Gemini rate limit exceeded. Wait a minute before retrying, or consider switching to a different model."
    }
    
    if (service === "Claude") {
      return "⚠️  Claude rate limit exceeded. Wait a moment before retrying, or consider switching to a different model."
    }
    
    const serviceMsg = service ? `${service} ` : ""
    return `⚠️  ${serviceMsg}rate limit exceeded. Consider switching models or waiting before retrying.`
  }
}
