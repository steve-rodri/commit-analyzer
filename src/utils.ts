/**
 * Common utility functions used across the application
 */

/**
 * Extracts error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error"
}

/**
 * Creates a promise-based readline interface for user input
 */
export function createPromiseReadline(): {
  question: (prompt: string) => Promise<string>
  close: () => void
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const readline = require("readline")
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return {
    question: (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, (answer: string) => {
          resolve(answer.trim())
        })
      })
    },
    close: () => rl.close(),
  }
}

/**
 * Sleep utility for async delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Formats file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Truncates text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength - 3) + "..."
}

/**
 * Calculates percentage with proper rounding
 */
export function calculatePercentage(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}