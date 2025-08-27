/**
 * Base class for application errors
 */
export abstract class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = "ApplicationError"
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR")
    this.name = "ValidationError"
  }
}

/**
 * Error for not found resources
 */
export class NotFoundError extends ApplicationError {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`, "NOT_FOUND")
    this.name = "NotFoundError"
  }
}