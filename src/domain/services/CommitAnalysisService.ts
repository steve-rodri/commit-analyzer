import { Commit } from '../entities/Commit'
import { AnalyzedCommit } from '../entities/AnalyzedCommit'
import { CommitHash } from '../value-objects/CommitHash'
import { ICommitRepository } from '../repositories/ICommitRepository'
import { IAnalysisRepository } from '../repositories/IAnalysisRepository'

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
        throw new Error(`Failed to analyze commit ${hash.getShortHash()}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    
    return analyzedCommits
  }

  /**
   * Validates that all commit hashes exist
   */
  async validateCommits(hashes: CommitHash[]): Promise<{ valid: CommitHash[]; invalid: CommitHash[] }> {
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
  async getCurrentUserCommits(limit?: number): Promise<Commit[]> {
    const userEmail = await this.commitRepository.getCurrentUserEmail()
    return this.commitRepository.getByAuthor(userEmail, limit)
  }

  /**
   * Checks if the analysis service is ready
   */
  async isAnalysisServiceReady(): Promise<boolean> {
    return this.analysisRepository.isAvailable()
  }
}