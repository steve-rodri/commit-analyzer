import { IAnalysisRepository } from "../../domain/repositories/IAnalysisRepository"
import { ILLMService } from "../../application/ports/out/ILLMService"
import { Analysis } from "../../domain/entities/Analysis"
import { Commit } from "../../domain/entities/Commit"
import { Category } from "../../domain/value-objects/Category"

/**
 * LLM-based analysis repository implementation
 */
export class LLMAnalysisRepository implements IAnalysisRepository {
  constructor(private readonly llmService: ILLMService) {}

  async analyze(commit: Commit): Promise<Analysis> {
    const result = await this.llmService.analyzeCommit(
      commit.getMessage(),
      commit.getDiff(),
    )

    const category = Category.fromType(result.category)
    
    return new Analysis(
      category,
      result.summary,
      result.description,
    )
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