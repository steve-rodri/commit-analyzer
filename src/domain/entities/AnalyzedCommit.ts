import { Commit } from './Commit'
import { Analysis } from './Analysis'
import { CommitHash } from '../value-objects/CommitHash'

/**
 * Domain entity representing a commit with its analysis
 */
export class AnalyzedCommit {
  constructor(
    private readonly commit: Commit,
    private readonly analysis: Analysis,
  ) {
    if (!commit) {
      throw new Error('Commit is required')
    }

    if (!analysis) {
      throw new Error('Analysis is required')
    }
  }

  getCommit(): Commit {
    return this.commit
  }

  getAnalysis(): Analysis {
    return this.analysis
  }

  getHash(): CommitHash {
    return this.commit.getHash()
  }

  getMessage(): string {
    return this.commit.getMessage()
  }

  getDate(): Date {
    return this.commit.getDate()
  }

  getYear(): number {
    return this.commit.getYear()
  }

  getShortHash(length: number = 8): string {
    return this.commit.getShortHash(length)
  }

  isLargeChange(): boolean {
    return this.commit.isLargeChange()
  }

  equals(other: AnalyzedCommit): boolean {
    return this.commit.equals(other.commit) && this.analysis.equals(other.analysis)
  }

  toCSVRow(): {
    year: number
    category: string
    summary: string
    description: string
  } {
    return {
      year: this.getYear(),
      category: this.analysis.getCategory().getValue(),
      summary: this.analysis.getSummary(),
      description: this.analysis.getDescription(),
    }
  }

  toReportData(): {
    hash: string
    shortHash: string
    message: string
    date: Date
    year: number
    category: string
    summary: string
    description: string
    isLargeChange: boolean
  } {
    return {
      hash: this.commit.getHash().getValue(),
      shortHash: this.getShortHash(),
      message: this.getMessage(),
      date: this.getDate(),
      year: this.getYear(),
      category: this.analysis.getCategory().getValue(),
      summary: this.analysis.getSummary(),
      description: this.analysis.getDescription(),
      isLargeChange: this.isLargeChange(),
    }
  }
}