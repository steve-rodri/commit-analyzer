import { ClaudeLLMAdapter } from "./claude-llm-adapter"
import { GeminiLLMAdapter } from "./gemini-llm-adapter"
import { LLMAdapter } from "./llm-adapter"
import { OpenAILLMAdapter } from "./openai-llm-adapter"

export class LLMAdapterFactory {
  static create(llm?: string): LLMAdapter {
    const normalizedLLM = llm?.toLowerCase()

    switch (normalizedLLM) {
      case "gemini":
        return new GeminiLLMAdapter()
      case "openai":
      case "gpt":
        return new OpenAILLMAdapter()
      case "claude":
      default:
        return new ClaudeLLMAdapter()
    }
  }

  static getSupportedLLMs(): string[] {
    return ["claude", "gemini", "openai"]
  }
}

