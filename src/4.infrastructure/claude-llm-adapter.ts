import { execSync } from "child_process"

import { CategoryType } from "@domain/category"

import { LLMAdapter } from "./llm-adapter"

export class ClaudeLLMAdapter extends LLMAdapter {
  private static readonly MAX_PROMPT_LENGTH = parseInt(
    process.env.CLAUDE_MAX_PROMPT_LENGTH || "100000",
    10,
  )

  protected getMaxPromptLength(): number {
    return ClaudeLLMAdapter.MAX_PROMPT_LENGTH
  }

  async detectAvailableModels(): Promise<string[]> {
    try {
      execSync("command -v claude", { stdio: "ignore" })
      return ["claude", "claude --model sonnet", "claude --model haiku"]
    } catch {
      return []
    }
  }

  async isAvailable(): Promise<boolean> {
    const available = await this.detectAvailableModels()
    return available.length > 0
  }

  protected async executeModelCommand(prompt: string): Promise<string> {
    const truncatedPrompt = this.truncatePrompt(prompt)

    if (this.verbose) {
      console.log(`  - Prompt length: ${truncatedPrompt.length} characters`)
    }

    const modelCommand = this.model || "claude --model sonnet"

    return execSync(modelCommand, {
      input: truncatedPrompt,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: LLMAdapter.DEFAULT_TIMEOUT,
    })
  }

  protected parseResponse(response: string): {
    category: CategoryType
    summary: string
    description: string
  } {
    try {
      // First try standard JSON parsing
      return super.parseResponse(response)
    } catch (error) {
      // Claude often responds in natural language format, so try to parse that
      if (this.verbose) {
        console.log(`  - Standard JSON parsing failed, trying Claude natural language parsing...`)
      }
      return this.parseClaudeNaturalLanguageResponse(response)
    }
  }

  private parseClaudeNaturalLanguageResponse(response: string): {
    category: CategoryType
    summary: string
    description: string
  } {
    // Try to extract category from various Claude response patterns
    const categoryMatch = response.match(/\*\*?Category\*\*?:?\s*(tweak|feature|process)/i) ||
                         response.match(/Category:\s*(tweak|feature|process)/i) ||
                         response.match(/\*\*(tweak|feature|process)\*\*/i) ||
                         response.match(/(tweak|feature|process)\s*commit/i) ||
                         response.match(/should be categorized as[:\s]*\*\*?(tweak|feature|process)/i)
    const category = categoryMatch?.[1]?.toLowerCase()

    if (!category || !this.isValidCategory(category)) {
      if (this.verbose) {
        console.log(`  - Failed to extract category from Claude response`)
        console.log(`  - Response snippet: ${response.substring(0, 500)}`)
      }
      throw new Error(`Could not extract valid category from Claude response`)
    }

    // Try to extract summary from patterns
    const summaryMatch = response.match(/\*\*?Summary\*\*?:?\s*([^\n\r]+)/i) ||
                        response.match(/Summary:\s*([^\n\r]+)/i)
    let summary = summaryMatch?.[1]?.trim()
    
    if (!summary) {
      // Fallback: try to find a descriptive line
      const lines = response.split('\n').filter(line => line.trim())
      summary = lines.find(line => 
        line.includes('refactor') || 
        line.includes('add') || 
        line.includes('fix') ||
        line.includes('update') ||
        line.includes('implement')
      )?.trim() || "Code changes"
    }

    // Try to extract description
    const descMatch = response.match(/\*\*?Description\*\*?:?\s*([\s\S]+?)(?=\n\n|\n\*\*|\n---|\n#|$)/i) ||
                     response.match(/Description:\s*([\s\S]+?)(?=\n\n|\n\*\*|\n---|\n#|$)/i)
    let description = descMatch?.[1]?.trim()
    
    if (!description) {
      // Fallback: extract the longest meaningful sentence
      const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 20)
      description = sentences[0]?.trim() || "Commit contains code changes"
    }

    // Clean up and truncate
    summary = summary.substring(0, 80).replace(/[*"]/g, '').trim()
    description = description.replace(/[*"]/g, '').trim()

    return {
      category: category as CategoryType,
      summary: summary || "Code changes",
      description: description || "This commit contains code changes."
    }
  }
}
