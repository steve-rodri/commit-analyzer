#!/usr/bin/env node

/**
 * Clean Architecture Main Entry Point
 * This is the composition root where all dependencies are wired together
 */

import { CLIApplication } from "./presentation/cli/CLIApplication"
import { CommitAnalysisController } from "./presentation/controllers/CommitAnalysisController"
import { ConsoleFormatter } from "./presentation/cli/formatters/ConsoleFormatter"

// Commands
import { AnalyzeCommand } from "./presentation/cli/commands/AnalyzeCommand"
import { ReportCommand } from "./presentation/cli/commands/ReportCommand"
import { ResumeCommand } from "./presentation/cli/commands/ResumeCommand"

// Use Cases
import { AnalyzeCommitsUseCase } from "./application/use-cases/AnalyzeCommitsUseCase"
import { GenerateReportUseCase } from "./application/use-cases/GenerateReportUseCase"
import { ResumeAnalysisUseCase } from "./application/use-cases/ResumeAnalysisUseCase"

// Domain Services
import { CommitAnalysisService } from "./domain/services/CommitAnalysisService"
import { ReportGenerationService } from "./domain/services/ReportGenerationService"

// Infrastructure - Adapters
import { GitAdapter } from "./infrastructure/adapters/git/GitAdapter"
import { ClaudeLLMAdapter } from "./infrastructure/adapters/llm/ClaudeLLMAdapter"
import { FileSystemStorageAdapter } from "./infrastructure/adapters/storage/FileSystemStorageAdapter"
import { JSONProgressTracker } from "./infrastructure/adapters/progress/JSONProgressTracker"

// Infrastructure - Repositories
import { GitCommitRepository } from "./infrastructure/repositories/GitCommitRepository"
import { LLMAnalysisRepository } from "./infrastructure/repositories/LLMAnalysisRepository"
import { FileStorageRepository } from "./infrastructure/repositories/FileStorageRepository"

// Shared
import { ApplicationError } from "./shared/errors/ApplicationError"

/**
 * Dependency Injection Container
 */
class DIContainer {
  // Adapters (Infrastructure Layer)
  private readonly gitAdapter = new GitAdapter()
  private readonly llmAdapter = new ClaudeLLMAdapter()
  private readonly storageAdapter = new FileSystemStorageAdapter()
  private readonly progressTracker = new JSONProgressTracker(
    this.storageAdapter,
  )

  // Repositories (Infrastructure Layer)
  private readonly commitRepository = new GitCommitRepository(this.gitAdapter)
  private readonly analysisRepository = new LLMAnalysisRepository(
    this.llmAdapter,
  )
  private readonly storageRepository = new FileStorageRepository(
    this.storageAdapter,
  )

  // Domain Services
  private readonly commitAnalysisService = new CommitAnalysisService(
    this.commitRepository,
    this.analysisRepository,
  )
  private readonly reportGenerationService = new ReportGenerationService()

  // Use Cases (Application Layer)
  private readonly analyzeCommitsUseCase = new AnalyzeCommitsUseCase(
    this.commitAnalysisService,
    this.progressTracker,
    this.storageRepository,
  )

  private readonly generateReportUseCase = new GenerateReportUseCase(
    this.reportGenerationService,
    this.storageRepository,
  )

  private readonly resumeAnalysisUseCase = new ResumeAnalysisUseCase(
    this.progressTracker,
    this.analyzeCommitsUseCase,
  )

  // Commands (Presentation Layer)
  private readonly analyzeCommand = new AnalyzeCommand(
    this.analyzeCommitsUseCase,
  )
  private readonly reportCommand = new ReportCommand(this.generateReportUseCase)
  private readonly resumeCommand = new ResumeCommand(this.resumeAnalysisUseCase)

  // Controller (Presentation Layer)
  private readonly controller = new CommitAnalysisController(
    this.analyzeCommand,
    this.reportCommand,
    this.resumeCommand,
  )

  // Main Application
  private readonly application = new CLIApplication(this.controller)

  getApplication(): CLIApplication {
    return this.application
  }
}

/**
 * Application Bootstrap
 */
async function bootstrap(): Promise<void> {
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
  bootstrap().catch((error) => {
    ConsoleFormatter.logError(`Failed to bootstrap application: ${error}`)
    process.exit(1)
  })
}

