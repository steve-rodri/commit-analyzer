import { Analysis } from "@domain/analysis"
import { Category } from "@domain/category"
import { Commit } from "@domain/commit"

import { ILLMService } from "@app/llm-service"

import { IAnalysisRepository } from "@presentation/analysis-repository.interface"

export class LLMAnalysisRepository implements IAnalysisRepository {
  constructor(private readonly llmService: ILLMService) {}

  async analyze(commit: Commit): Promise<Analysis> {
    const result = await this.llmService.analyzeCommit(
      commit.getMessage(),
      commit.getDiff(),
    )

    const category = Category.fromType(result.category)

    return new Analysis({
      category,
      summary: result.summary,
      description: result.description,
    })
  }

  async isAvailable(): Promise<boolean> {
    return this.llmService.isAvailable()
  }

  getMaxRetries(): number {
    return this.llmService.getMaxRetries()
  }

  setVerbose(verbose: boolean): void {
    this.llmService.setVerbose(verbose)
  }
}
