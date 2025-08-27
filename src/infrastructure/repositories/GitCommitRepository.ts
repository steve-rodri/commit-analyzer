import { ICommitRepository } from "../../domain/repositories/ICommitRepository"
import { IVersionControlService } from "../../application/ports/out/IVersionControlService"
import { Commit } from "../../domain/entities/Commit"
import { CommitHash } from "../../domain/value-objects/CommitHash"

/**
 * Git-based commit repository implementation
 */
export class GitCommitRepository implements ICommitRepository {
  constructor(private readonly versionControlService: IVersionControlService) {}

  async getByHash(hash: CommitHash): Promise<Commit> {
    const commitInfo = await this.versionControlService.getCommitInfo(hash.getValue())
    
    return new Commit(
      hash,
      commitInfo.message,
      commitInfo.date,
      commitInfo.diff,
    )
  }

  async getByAuthor(authorEmail: string, limit?: number): Promise<Commit[]> {
    const commitHashes = await this.versionControlService.getUserAuthoredCommits(authorEmail, limit)
    const commits: Commit[] = []

    for (const hashString of commitHashes) {
      try {
        const hash = CommitHash.create(hashString)
        const commit = await this.getByHash(hash)
        commits.push(commit)
      } catch (error) {
        console.warn(`Warning: Failed to load commit ${hashString}:`, error)
      }
    }

    return commits
  }

  async getByHashes(hashes: CommitHash[]): Promise<Commit[]> {
    const commits: Commit[] = []

    for (const hash of hashes) {
      try {
        const commit = await this.getByHash(hash)
        commits.push(commit)
      } catch (error) {
        console.warn(`Warning: Failed to load commit ${hash.getShortHash()}:`, error)
      }
    }

    return commits
  }

  async exists(hash: CommitHash): Promise<boolean> {
    return this.versionControlService.validateCommitHash(hash.getValue())
  }

  async getCurrentUserEmail(): Promise<string> {
    return this.versionControlService.getCurrentUserEmail()
  }

  async getCurrentUserName(): Promise<string> {
    return this.versionControlService.getCurrentUserName()
  }

  async isValidRepository(): Promise<boolean> {
    return this.versionControlService.isValidRepository()
  }
}