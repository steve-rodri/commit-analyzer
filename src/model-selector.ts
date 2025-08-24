import * as readline from "readline"
import { LLMService } from "./llm"
import { CLIOptions } from "./cli"

export class ModelSelector {
  static async selectLLMModel(options: CLIOptions): Promise<string> {
    const selectedModel = await this.determineModel(options)
    this.configureModel(selectedModel, options)
    return selectedModel
  }

  private static async determineModel(options: CLIOptions): Promise<string> {
    if (options.model) {
      return options.model
    }

    const availableModels = LLMService.detectAvailableModels()
    const defaultModel = LLMService.detectDefaultModel()
    
    return await this.promptUserForModel(availableModels, defaultModel)
  }

  private static configureModel(selectedModel: string, options: CLIOptions): void {
    LLMService.setModel(selectedModel)
    LLMService.setVerbose(options.verbose || false)
  }

  private static async promptUserForModel(
    availableModels: string[],
    defaultModel: string,
  ): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise<string>((resolve) => {
      const prompt = `Select LLM model (${availableModels.join("/")}) [${defaultModel}]: `
      
      rl.question(prompt, (answer) => {
        rl.close()
        resolve(answer.trim() || defaultModel)
      })
    })
  }
}

