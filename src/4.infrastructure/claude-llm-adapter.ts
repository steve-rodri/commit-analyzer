import { execSync } from "child_process"

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
}
