#!/usr/bin/env node

import { ApplicationError } from "@domain/application-error"

import { ConsoleFormatter } from "@presentation/console-formatter"

import { DIContainer } from "./di"

async function main(): Promise<void> {
  try {
    const container = new DIContainer()
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

// Run the application if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    ConsoleFormatter.logError(`Failed to bootstrap application: ${error}`)
    process.exit(1)
  })
}
