import { Analysis } from "@domain/analysis"
import { Commit } from "@domain/commit"

import { IAnalysisRepository } from "@presentation/analysis-repository.interface"

import { CacheService } from "./cache-service"

/**
 * Cached analysis repository that wraps another analysis repository
 */
export class CachedAnalysisRepository implements IAnalysisRepository {
  constructor(
    private readonly baseRepository: IAnalysisRepository,
    private readonly cacheService: CacheService,
  ) {}

  async analyze(commit: Commit): Promise<Analysis> {
    const commitHash = commit.getHash().getValue()

    // Try to get from cache first
    const cachedAnalysis = await this.cacheService.get(commitHash)
    if (cachedAnalysis) {
      return cachedAnalysis
    }

    // Cache miss - analyze with base repository
    const analysis = await this.baseRepository.analyze(commit)

    // Store in cache for next time
    await this.cacheService.set(commitHash, analysis)

    return analysis
  }

  async isAvailable(): Promise<boolean> {
    return this.baseRepository.isAvailable()
  }

  getMaxRetries(): number {
    return this.baseRepository.getMaxRetries()
  }

  setVerbose(verbose: boolean): void {
    this.baseRepository.setVerbose(verbose)
  }
}