/**
 * Value object for Git commit hash
 */
export class CommitHash {
  private constructor(private readonly value: string) {}

  static create(hash: string): CommitHash {
    if (!hash || typeof hash !== 'string') {
      throw new Error('Commit hash cannot be empty')
    }

    // Git short hash is minimum 4 characters, full hash is 40
    if (hash.length < 4 || hash.length > 40) {
      throw new Error('Invalid commit hash length')
    }

    // Only hexadecimal characters allowed
    if (!/^[a-f0-9]+$/i.test(hash)) {
      throw new Error('Commit hash must contain only hexadecimal characters')
    }

    return new CommitHash(hash)
  }

  getValue(): string {
    return this.value
  }

  getShortHash(length: number = 8): string {
    return this.value.substring(0, Math.min(length, this.value.length))
  }

  equals(other: CommitHash): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}