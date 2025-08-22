export class CommitAnalyzerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = "CommitAnalyzerError"
  }
}

export class GitError extends CommitAnalyzerError {
  constructor(message: string) {
    super(message, "GIT_ERROR")
  }
}

export class LLMError extends CommitAnalyzerError {
  constructor(message: string) {
    super(message, "LLM_ERROR")
  }
}

export class ValidationError extends CommitAnalyzerError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR")
  }
}

export class FileError extends CommitAnalyzerError {
  constructor(message: string) {
    super(message, "FILE_ERROR")
  }
}

export function handleError(error: unknown): never {
  if (error instanceof CommitAnalyzerError) {
    console.error(`Error [${error.code}]: ${error.message}`)
    process.exit(1)
  }

  if (error instanceof Error) {
    console.error(`Unexpected error: ${error.message}`)
    process.exit(1)
  }

  console.error("Unknown error occurred")
  process.exit(1)
}

