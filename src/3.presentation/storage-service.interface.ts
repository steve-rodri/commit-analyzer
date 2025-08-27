export interface IStorageService {
  /**
   * Writes content to a file
   */
  writeFile(filePath: string, content: string): Promise<void>

  /**
   * Reads content from a file
   */
  readFile(filePath: string): Promise<string>

  /**
   * Checks if a file exists
   */
  fileExists(filePath: string): Promise<boolean>

  /**
   * Creates a directory if it doesn't exist
   */
  ensureDirectory(directoryPath: string): Promise<void>

  /**
   * Deletes a file
   */
  deleteFile(filePath: string): Promise<void>

  /**
   * Reads lines from a file
   */
  readLines(filePath: string): Promise<string[]>
}

