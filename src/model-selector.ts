import * as readline from "readline"
import { LLMService } from "./llm"
import { CLIOptions } from "./cli"

export class ModelSelector {
  static async selectLLMModel(options: CLIOptions): Promise<string> {
    const availableModels = LLMService.detectAvailableModels()
    const defaultModel = LLMService.detectDefaultModel()
    let selectedModel = options.model
    if (!selectedModel) {
      selectedModel = await promptUserForModelSelection(
        availableModels,
        defaultModel,
      )
    }
    LLMService.setModel(selectedModel)
    LLMService.setVerbose(options.verbose || false)
    return selectedModel
  }
}

function promptUserForModelSelection(
  availableModels: string[],
  defaultModel: string,
): Promise<string> {
  const rlModel = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise<string>((resolve) =>
    rlModel.question(
      `Select LLM model (${availableModels.join("/")}) [${defaultModel}]: `,
      (answer) => {
        rlModel.close()
        resolve(answer.trim() || defaultModel)
      },
    ),
  )
}

