import { Category } from '../value-objects/Category'

/**
 * Domain entity representing the analysis of a commit
 */
export class Analysis {
  private static readonly MAX_SUMMARY_LENGTH = 80
  private static readonly MIN_DESCRIPTION_LENGTH = 10

  constructor(
    private readonly category: Category,
    private readonly summary: string,
    private readonly description: string,
  ) {
    if (!summary || summary.trim().length === 0) {
      throw new Error('Summary cannot be empty')
    }

    if (!description || description.trim().length === 0) {
      throw new Error('Description cannot be empty')
    }

    if (summary.length > Analysis.MAX_SUMMARY_LENGTH) {
      throw new Error(`Summary cannot exceed ${Analysis.MAX_SUMMARY_LENGTH} characters`)
    }

    if (description.length < Analysis.MIN_DESCRIPTION_LENGTH) {
      throw new Error(`Description must be at least ${Analysis.MIN_DESCRIPTION_LENGTH} characters`)
    }
  }

  getCategory(): Category {
    return this.category
  }

  getSummary(): string {
    return this.summary
  }

  getDescription(): string {
    return this.description
  }

  getSummaryTruncated(): string {
    return this.summary.length > Analysis.MAX_SUMMARY_LENGTH 
      ? this.summary.substring(0, Analysis.MAX_SUMMARY_LENGTH - 3) + '...'
      : this.summary
  }

  isFeatureAnalysis(): boolean {
    return this.category.isFeature()
  }

  isTweakAnalysis(): boolean {
    return this.category.isTweak()
  }

  isProcessAnalysis(): boolean {
    return this.category.isProcess()
  }

  equals(other: Analysis): boolean {
    return this.category.equals(other.category) &&
           this.summary === other.summary &&
           this.description === other.description
  }

  toPlainObject(): {
    category: string
    summary: string
    description: string
  } {
    return {
      category: this.category.getValue(),
      summary: this.summary,
      description: this.description,
    }
  }
}