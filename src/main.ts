#!/usr/bin/env node

import { ApplicationError } from "@domain/application-error"

import { ConsoleFormatter } from "@presentation/console-formatter"

import { DIContainer } from "./di"

async function main(): Promise<void> {
  try {
    // Extract llm option from command line args before creating container
    const llmOption = extractLLMOption(process.argv)
    const container = new DIContainer({ llm: llmOption })
    const app = container.getApplication()

    await app.run(process.argv)
  } catch (error) {
    if (error instanceof ApplicationError) {
      ConsoleFormatter.logError(`[${error.code}]: ${error.message}`)
      process.exit(1)
    }

    if (error instanceof Error) {
      ConsoleFormatter.logError(`Unexpected error: ${error.message}`)
      process.exit(1)
    }

    ConsoleFormatter.logError("Unknown error occurred")
    process.exit(1)
  }
}

/**
 * Extract the --llm option from command line arguments
 * This is needed before creating the DI container
 */
function extractLLMOption(args: string[]): string | undefined {
  const llmIndex = args.findIndex(arg => arg === '--llm')
  if (llmIndex !== -1 && llmIndex + 1 < args.length) {
    return args[llmIndex + 1]
  }
  return undefined
}

// Run the application if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    ConsoleFormatter.logError(`Failed to bootstrap application: ${error}`)
    process.exit(1)
  })
}
