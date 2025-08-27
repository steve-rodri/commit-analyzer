export interface IVersionControlService {
  /**
   * Gets detailed commit information by hash
   */
  getCommitInfo(hash: string): Promise<{
    hash: string
    message: string
    date: Date
    diff: string
  }>

  /**
   * Validates if a commit hash exists
   */
  validateCommitHash(hash: string): Promise<boolean>

  /**
   * Checks if current directory is a valid repository
   */
  isValidRepository(): Promise<boolean>

  /**
   * Gets current user's email from repository config
   */
  getCurrentUserEmail(): Promise<string>

  /**
   * Gets current user's name from repository config
   */
  getCurrentUserName(): Promise<string>

  /**
   * Gets commits authored by a specific user
   */
  getUserAuthoredCommits(authorEmail: string, limit?: number): Promise<string[]>
}
