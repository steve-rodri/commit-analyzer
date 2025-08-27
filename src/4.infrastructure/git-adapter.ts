import { execSync } from "child_process"

import { IVersionControlService } from "@presentation/version-control-service.interface"

import { getErrorMessage } from "../utils"

export class GitAdapter implements IVersionControlService {
  private static readonly LARGE_DIFF_BUFFER = 50 * 1024 * 1024 // 50MB buffer for large diffs
  private static readonly EXEC_OPTIONS = {
    encoding: "utf8" as const,
    stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"],
  }

  async getCommitInfo(hash: string): Promise<{
    hash: string
    message: string
    date: Date
    diff: string
  }> {
    try {
      const showOutput = execSync(
        `git show --format="%H|%s|%ci" --no-patch "${hash}"`,
        GitAdapter.EXEC_OPTIONS,
      ).trim()

      const [fullHash, message, dateStr] = showOutput.split("|")
      const date = new Date(dateStr)

      const diff = execSync(`git show "${hash}"`, {
        ...GitAdapter.EXEC_OPTIONS,
        maxBuffer: GitAdapter.LARGE_DIFF_BUFFER,
      })

      return {
        hash: fullHash,
        message,
        date,
        diff,
      }
    } catch (error) {
      throw new Error(
        `Failed to get commit info for ${hash}: ${getErrorMessage(error)}`,
      )
    }
  }

  async validateCommitHash(hash: string): Promise<boolean> {
    try {
      execSync(`git rev-parse --verify "${hash}"`, GitAdapter.EXEC_OPTIONS)
      return true
    } catch {
      return false
    }
  }

  async isValidRepository(): Promise<boolean> {
    try {
      execSync("git rev-parse --git-dir", GitAdapter.EXEC_OPTIONS)
      return true
    } catch {
      return false
    }
  }

  async getCurrentUserEmail(): Promise<string> {
    try {
      return execSync("git config user.email", GitAdapter.EXEC_OPTIONS).trim()
    } catch (error) {
      throw new Error(
        `Failed to get current user email: ${getErrorMessage(error)}`,
      )
    }
  }

  async getCurrentUserName(): Promise<string> {
    try {
      return execSync("git config user.name", GitAdapter.EXEC_OPTIONS).trim()
    } catch (error) {
      throw new Error(
        `Failed to get current user name: ${getErrorMessage(error)}`,
      )
    }
  }

  async getRepositoryName(): Promise<string> {
    try {
      // Try to get the repository name from remote origin URL
      const remoteUrl = execSync("git config --get remote.origin.url", GitAdapter.EXEC_OPTIONS).trim()
      
      // Extract repository name from various URL formats
      // git@github.com:user/repo.git -> repo
      // https://github.com/user/repo.git -> repo
      // https://github.com/user/repo -> repo
      const match = remoteUrl.match(/\/([^\/]+?)(?:\.git)?$/)
      if (match && match[1]) {
        return match[1]
      }
      
      // Fallback: get the directory name
      const dirName = execSync("basename $(git rev-parse --show-toplevel)", GitAdapter.EXEC_OPTIONS).trim()
      return dirName
    } catch (error) {
      // Final fallback: use current directory name
      try {
        return execSync("basename $(pwd)", GitAdapter.EXEC_OPTIONS).trim()
      } catch {
        return "Unknown Project"
      }
    }
  }

  async getUserAuthoredCommits(params: {
    authorEmail: string
    limit?: number
    since?: string
    until?: string
  }): Promise<string[]> {
    const { authorEmail, limit, since, until } = params
    try {
      const limitFlag = limit ? `--max-count=${limit}` : ""
      const sinceFlag = since ? `--since="${since}"` : ""
      const untilFlag = until ? `--until="${until}"` : ""

      const output = execSync(
        `git log --author="${authorEmail}" --format="%H" --no-merges ${limitFlag} ${sinceFlag} ${untilFlag}`,
        GitAdapter.EXEC_OPTIONS,
      ).trim()

      return this.parseCommitHashes(output)
    } catch (error) {
      throw new Error(
        `Failed to get user authored commits: ${getErrorMessage(error)}`,
      )
    }
  }

  private parseCommitHashes(output: string): string[] {
    if (!output) {
      return []
    }
    return output.split("\n").filter((hash) => hash.length > 0)
  }
}
