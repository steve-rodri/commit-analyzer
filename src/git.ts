import { execSync } from "child_process"
import { CommitInfo } from "./types"

export class GitService {
  static async getCommitInfo(hash: string): Promise<CommitInfo> {
    try {
      const showOutput = execSync(
        `git show --format="%H|%s|%ci" --no-patch "${hash}"`,
        {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        },
      ).trim()

      const [fullHash, message, dateStr] = showOutput.split("|")
      const date = new Date(dateStr)
      const year = date.getFullYear()

      const diff = execSync(`git show "${hash}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
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
        `Failed to get commit info for ${hash}: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  static validateCommitHash(hash: string): boolean {
    try {
      execSync(`git rev-parse --verify "${hash}"`, {
        stdio: ["pipe", "pipe", "pipe"],
      })
      return true
    } catch {
      return false
    }
  }

  static isGitRepository(): boolean {
    try {
      execSync("git rev-parse --git-dir", {
        stdio: ["pipe", "pipe", "pipe"],
      })
      return true
    } catch {
      return false
    }
  }

  static getCurrentUserEmail(): string {
    try {
      return execSync("git config user.email", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim()
    } catch (error) {
      throw new Error(
        `Failed to get current user email: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  static getCurrentUserName(): string {
    try {
      return execSync("git config user.name", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim()
    } catch (error) {
      throw new Error(
        `Failed to get current user name: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  static getUserAuthoredCommits(author?: string, limit?: number): string[] {
    try {
      const authorFilter = author || this.getCurrentUserEmail()
      const limitFlag = limit ? `--max-count=${limit}` : ""

      const output = execSync(
        `git log --author="${authorFilter}" --format="%H" ${limitFlag}`,
        {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        },
      ).trim()

      if (!output) {
        return []
      }

      return output.split("\n").filter((hash) => hash.length > 0)
    } catch (error) {
      throw new Error(
        `Failed to get user authored commits: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }
}

