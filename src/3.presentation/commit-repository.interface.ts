import { Commit } from "@domain/commit"
import { CommitHash } from "@domain/commit-hash"

/**
 * Repository interface for accessing commit data
 */
export interface ICommitRepository {
  /**
   * Retrieves a commit by its hash
   */
  getByHash(hash: CommitHash): Promise<Commit>

  /**
   * Retrieves commits authored by a specific user
   */
  getByAuthor(
    authorEmail: string, 
    limit?: number,
    since?: string,
    until?: string
  ): Promise<Commit[]>

  /**
   * Retrieves commits from a list of hashes
   */
  getByHashes(hashes: CommitHash[]): Promise<Commit[]>

  /**
   * Validates if a commit hash exists in the repository
   */
  exists(hash: CommitHash): Promise<boolean>

  /**
   * Gets the current user's email from the repository configuration
   */
  getCurrentUserEmail(): Promise<string>

  /**
   * Gets the current user's name from the repository configuration
   */
  getCurrentUserName(): Promise<string>

  /**
   * Checks if the current directory is a valid repository
   */
  isValidRepository(): Promise<boolean>
}
