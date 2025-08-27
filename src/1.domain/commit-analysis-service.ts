import { IAnalysisRepository } from "@presentation/analysis-repository.interface"
import { ICommitRepository } from "@presentation/commit-repository.interface"

import { AnalyzedCommit } from "./analyzed-commit"
import { Commit } from "./commit"
import { CommitHash } from "./commit-hash"

/**
 * Domain service for commit analysis operations
 */
export class CommitAnalysisService {
  constructor(
    private readonly commitRepository: ICommitRepository,
    private readonly analysisRepository: IAnalysisRepository,
  ) {}

  /**
   * Analyzes a single commit
   */
  async analyzeCommit(hash: CommitHash): Promise<AnalyzedCommit> {
    const commit = await this.commitRepository.getByHash(hash)
    const analysis = await this.analysisRepository.analyze(commit)

    return new AnalyzedCommit(commit, analysis)
  }

  /**
   * Analyzes multiple commits
   */
  async analyzeCommits(hashes: CommitHash[]): Promise<AnalyzedCommit[]> {
    const analyzedCommits: AnalyzedCommit[] = []

    for (const hash of hashes) {
      try {
        const analyzedCommit = await this.analyzeCommit(hash)
        analyzedCommits.push(analyzedCommit)
      } catch (error) {
        // Re-throw the error - let the application layer handle logging
        throw new Error(
          `Failed to analyze commit ${hash.getShortHash()}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    return analyzedCommits
  }

  /**
   * Validates that all commit hashes exist
   */
  async validateCommits(
    hashes: CommitHash[],
  ): Promise<{ valid: CommitHash[]; invalid: CommitHash[] }> {
    const valid: CommitHash[] = []
    const invalid: CommitHash[] = []

    for (const hash of hashes) {
      const exists = await this.commitRepository.exists(hash)
      if (exists) {
        valid.push(hash)
      } else {
        invalid.push(hash)
      }
    }

    return { valid, invalid }
  }

  /**
   * Gets commits authored by the current user
   */
  async getCurrentUserCommits(params?: {
    limit?: number
    since?: string
    until?: string
  }): Promise<Commit[]> {
    const userEmail = await this.commitRepository.getCurrentUserEmail()
    return this.commitRepository.getByAuthor({
      authorEmail: userEmail,
      limit: params?.limit,
      since: params?.since,
      until: params?.until,
    })
  }

  /**
   * Checks if the analysis service is ready
   */
  async isAnalysisServiceReady(): Promise<boolean> {
    return this.analysisRepository.isAvailable()
  }
}
