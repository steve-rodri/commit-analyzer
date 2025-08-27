import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs"
import { join } from "path"
import { IStorageService } from "../../../application/ports/out/IStorageService"
import { getErrorMessage } from "../../../utils"

/**
 * File system storage adapter
 */
export class FileSystemStorageAdapter implements IStorageService {
  private static readonly DEFAULT_ENCODING = "utf8"

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      writeFileSync(filePath, content, FileSystemStorageAdapter.DEFAULT_ENCODING)
    } catch (error) {
      throw new Error(
        `Failed to write file ${filePath}: ${getErrorMessage(error)}`,
      )
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      return readFileSync(filePath, FileSystemStorageAdapter.DEFAULT_ENCODING)
    } catch (error) {
      throw new Error(
        `Failed to read file ${filePath}: ${getErrorMessage(error)}`,
      )
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    return existsSync(filePath)
  }

  async ensureDirectory(directoryPath: string): Promise<void> {
    try {
      mkdirSync(directoryPath, { recursive: true })
    } catch (error) {
      throw new Error(
        `Failed to create directory ${directoryPath}: ${getErrorMessage(error)}`,
      )
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      if (await this.fileExists(filePath)) {
        unlinkSync(filePath)
      }
    } catch (error) {
      throw new Error(
        `Failed to delete file ${filePath}: ${getErrorMessage(error)}`,
      )
    }
  }

  async readLines(filePath: string): Promise<string[]> {
    const content = await this.readFile(filePath)
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }

  /**
   * Resolves a filename with optional output directory
   */
  resolveOutputPath(filename: string, outputDir?: string): string {
    if (outputDir) {
      return join(outputDir, filename)
    }
    return filename
  }
}