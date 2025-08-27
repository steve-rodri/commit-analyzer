/**
 * Value object for commit analysis category
 */
export type CategoryType = "tweak" | "feature" | "process"

export class Category {
  private static readonly VALID_CATEGORIES: CategoryType[] = ["tweak", "feature", "process"]

  private constructor(private readonly value: CategoryType) {}

  static create(category: string): Category {
    if (!category || typeof category !== 'string') {
      throw new Error('Category cannot be empty')
    }

    const normalizedCategory = category.toLowerCase().trim() as CategoryType
    
    if (!this.VALID_CATEGORIES.includes(normalizedCategory)) {
      throw new Error(`Invalid category: ${category}. Must be one of: ${this.VALID_CATEGORIES.join(', ')}`)
    }

    return new Category(normalizedCategory)
  }

  static fromType(category: CategoryType): Category {
    return new Category(category)
  }

  getValue(): CategoryType {
    return this.value
  }

  equals(other: Category): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }

  isFeature(): boolean {
    return this.value === "feature"
  }

  isTweak(): boolean {
    return this.value === "tweak"
  }

  isProcess(): boolean {
    return this.value === "process"
  }
}