import { CommitHash } from "./commit-hash"

/**
 * Domain entity representing a Git commit
 */
export class Commit {
  private readonly hash: CommitHash
  private readonly message: string
  private readonly date: Date
  private readonly diff: string

  constructor(params: {
    hash: CommitHash
    message: string
    date: Date
    diff: string
  }) {
    const { hash, message, date, diff } = params
    this.hash = hash
    this.message = message
    this.date = date
    this.diff = diff
    if (!message || message.trim().length === 0) {
      throw new Error("Commit message cannot be empty")
    }

    if (!date) {
      throw new Error("Commit date is required")
    }

    if (!diff) {
      throw new Error("Commit diff is required")
    }
  }

  getHash(): CommitHash {
    return this.hash
  }

  getMessage(): string {
    return this.message
  }

  getDate(): Date {
    return new Date(this.date)
  }

  getDiff(): string {
    return this.diff
  }

  getYear(): number {
    return this.date.getFullYear()
  }

  getShortHash(length: number = 8): string {
    return this.hash.getShortHash(length)
  }

  getDiffStats(): {
    additions: number
    deletions: number
    filesChanged: number
  } {
    const lines = this.diff.split("\n")
    let additions = 0
    let deletions = 0
    const filesChanged = new Set<string>()

    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        additions++
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletions++
      } else if (line.startsWith("diff --git")) {
        // Extract filename from diff header
        const match = line.match(/diff --git a\/(.+) b\/(.+)/)
        if (match) {
          filesChanged.add(match[1])
        }
      }
    }

    return {
      additions,
      deletions,
      filesChanged: filesChanged.size,
    }
  }

  isLargeChange(): boolean {
    const stats = this.getDiffStats()
    return stats.additions + stats.deletions > 100 || stats.filesChanged > 10
  }

  equals(other: Commit): boolean {
    return this.hash.equals(other.hash)
  }
}
