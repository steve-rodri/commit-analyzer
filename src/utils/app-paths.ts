import path from "path"

/**
 * Utility for managing application data directory paths
 */
export class AppPaths {
  private static readonly APP_DATA_DIR = ".commit-analyzer"
  
  /**
   * Get the application data directory path
   */
  static getAppDataDir(baseDir: string = process.cwd()): string {
    return path.join(baseDir, AppPaths.APP_DATA_DIR)
  }
  
  /**
   * Get the cache directory path
   */
  static getCacheDir(baseDir: string = process.cwd()): string {
    return path.join(AppPaths.getAppDataDir(baseDir), "cache")
  }
  
  /**
   * Get the progress file path
   */
  static getProgressFilePath(baseDir: string = process.cwd()): string {
    return path.join(AppPaths.getAppDataDir(baseDir), "progress.json")
  }
  
  /**
   * Get any file path within the app data directory
   */
  static getAppDataFilePath(fileName: string, baseDir: string = process.cwd()): string {
    return path.join(AppPaths.getAppDataDir(baseDir), fileName)
  }
}