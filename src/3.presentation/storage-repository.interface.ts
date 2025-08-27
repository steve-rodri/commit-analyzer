import { AnalyzedCommit } from "@domain/analyzed-commit"

export interface IStorageRepository {
  /**
   * Exports analyzed commits to CSV format
   */
  exportToCSV(commits: AnalyzedCommit[], filePath: string): Promise<void>

  /**
   * Imports commits from CSV format
   */
  importFromCSV(filePath: string): Promise<AnalyzedCommit[]>

  /**
   * Generates a markdown report from analyzed commits
   */
  generateReport(commits: AnalyzedCommit[], outputPath: string): Promise<void>

  /**
   * Reads commits from a file (one hash per line)
   */
  readCommitHashesFromFile(filePath: string): Promise<string[]>

  /**
   * Ensures a directory exists
   */
  ensureDirectoryExists(directoryPath: string): Promise<void>
}
