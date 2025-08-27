import { execSync } from "child_process"

import { LLMAdapter } from "./llm-adapter"

export class OpenAILLMAdapter extends LLMAdapter {
  private static readonly MAX_PROMPT_LENGTH = parseInt(
    process.env.OPENAI_MAX_PROMPT_LENGTH || "100000",
    10,
  )

  protected getMaxPromptLength(): number {
    return OpenAILLMAdapter.MAX_PROMPT_LENGTH
  }

  async detectAvailableModels(): Promise<string[]> {
    try {
      execSync("command -v codex", { stdio: "ignore" })
      return ["codex -q", "openai"]
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

    const modelCommand = this.model || "codex -q"

    // Handle codex -q quirk: requires prompt as command line argument
    if (modelCommand.includes("-q")) {
      const escapedPrompt = truncatedPrompt.replace(/"/g, '\\"')
      return execSync(`${modelCommand} "${escapedPrompt}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: LLMAdapter.DEFAULT_TIMEOUT,
      })
    }

    // Fallback for non-quiet mode commands
    return execSync(modelCommand, {
      input: truncatedPrompt,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: LLMAdapter.DEFAULT_TIMEOUT,
    })
  }
}

