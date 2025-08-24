import { execSync } from "child_process"
import { CommitInfo } from "./types"

export class GitService {
  private static readonly LARGE_DIFF_BUFFER = 50 * 1024 * 1024 // 50MB buffer for large diffs
  private static readonly EXEC_OPTIONS = {
    encoding: "utf8" as const,
    stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"],
  }

  static async getCommitInfo(hash: string): Promise<CommitInfo> {
    try {
      const showOutput = execSync(
        `git show --format="%H|%s|%ci" --no-patch "${hash}"`,
        this.EXEC_OPTIONS,
      ).trim()

      const [fullHash, message, dateStr] = showOutput.split("|")
      const date = new Date(dateStr)
      const year = date.getFullYear()

      const diff = execSync(`git show "${hash}"`, {
        ...this.EXEC_OPTIONS,
        maxBuffer: this.LARGE_DIFF_BUFFER,
      })

      return {
        hash: fullHash,
        message,
        date,
        diff,
        year,
      }
    } catch (error) {
      throw new Error(
        `Failed to get commit info for ${hash}: ${this.getErrorMessage(error)}`,
      )
    }
  }

  static validateCommitHash(hash: string): boolean {
    try {
      execSync(`git rev-parse --verify "${hash}"`, this.EXEC_OPTIONS)
      return true
    } catch {
      return false
    }
  }

  static isGitRepository(): boolean {
    try {
      execSync("git rev-parse --git-dir", this.EXEC_OPTIONS)
      return true
    } catch {
      return false
    }
  }

  static getCurrentUserEmail(): string {
    try {
      return execSync("git config user.email", this.EXEC_OPTIONS).trim()
    } catch (error) {
      throw new Error(
        `Failed to get current user email: ${this.getErrorMessage(error)}`,
      )
    }
  }

  static getCurrentUserName(): string {
    try {
      return execSync("git config user.name", this.EXEC_OPTIONS).trim()
    } catch (error) {
      throw new Error(
        `Failed to get current user name: ${this.getErrorMessage(error)}`,
      )
    }
  }

  static getUserAuthoredCommits(author?: string, limit?: number): string[] {
    try {
      const authorFilter = author || this.getCurrentUserEmail()
      const limitFlag = limit ? `--max-count=${limit}` : ""

      const output = execSync(
        `git log --author="${authorFilter}" --format="%H" --no-merges ${limitFlag}`,
        this.EXEC_OPTIONS,
      ).trim()

      return this.parseCommitHashes(output)
    } catch (error) {
      throw new Error(
        `Failed to get user authored commits: ${this.getErrorMessage(error)}`,
      )
    }
  }

  private static parseCommitHashes(output: string): string[] {
    if (!output) {
      return []
    }
    return output.split("\n").filter((hash) => hash.length > 0)
  }

  private static getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error"
  }
}

