import { execSync } from "child_process"

import { LLMAdapter } from "./llm-adapter"

export class GeminiLLMAdapter extends LLMAdapter {
  private static readonly MAX_PROMPT_LENGTH = parseInt(
    process.env.GEMINI_MAX_PROMPT_LENGTH || "100000",
    10,
  )

  async detectAvailableModels(): Promise<string[]> {
    try {
      execSync("command -v gemini", { stdio: "ignore" })
      return ["gemini"]
    } catch {
      return []
    }
  }

  async isAvailable(): Promise<boolean> {
    const available = await this.detectAvailableModels()
    return available.length > 0
  }

  protected async executeModelCommand(prompt: string): Promise<string> {
    const truncatedPrompt = this.truncatePromptForGemini(prompt)

    if (this.verbose) {
      console.log(`  - Prompt length: ${truncatedPrompt.length} characters`)
    }

    const modelCommand = this.model || "gemini"

    return execSync(modelCommand, {
      input: truncatedPrompt,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: LLMAdapter.DEFAULT_TIMEOUT,
    })
  }

  private truncatePromptForGemini(prompt: string): string {
    if (prompt.length <= GeminiLLMAdapter.MAX_PROMPT_LENGTH) {
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
    const maxDiffLength = Math.max(
      1000,
      GeminiLLMAdapter.MAX_PROMPT_LENGTH - overhead,
    )

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

