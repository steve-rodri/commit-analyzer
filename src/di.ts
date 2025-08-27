import { CommitAnalysisService } from "@domain/commit-analysis-service"
import { ReportGenerationService } from "@domain/report-generation-service"

import { AnalyzeCommitsUseCase } from "@app/analyze-commits.usecase"
import { GenerateReportUseCase } from "@app/generate-report.usecase"
import { ResumeAnalysisUseCase } from "@app/resume-analysis.usecase"

import { AnalyzeCommand } from "@presentation/analyze-command"
import { CLIApplication } from "@presentation/cli-application"
import { CommitAnalysisController } from "@presentation/commit-analysis-controller"
import { ReportCommand } from "@presentation/report-command"
import { ResumeCommand } from "@presentation/resume-command"

import { ClaudeLLMAdapter } from "@infra/claude-llm-adapter"
import { FileStorageRepository } from "@infra/file-storage-repository"
import { FileSystemStorageAdapter } from "@infra/file-system-storage-adapter"
import { GitAdapter } from "@infra/git-adapter"
import { GitCommitRepository } from "@infra/git-commit-repository"
import { JSONProgressTracker } from "@infra/json-progress-tracker"
import { LLMAnalysisRepository } from "@infra/llm-analysis-repository"

export class DIContainer {
  private readonly gitAdapter = new GitAdapter()
  private readonly llmAdapter = new ClaudeLLMAdapter()
  private readonly storageAdapter = new FileSystemStorageAdapter()
  private readonly progressTracker = new JSONProgressTracker(
    this.storageAdapter,
  )

  private readonly commitRepository = new GitCommitRepository(this.gitAdapter)
  private readonly analysisRepository = new LLMAnalysisRepository(
    this.llmAdapter,
  )
  private readonly storageRepository = new FileStorageRepository(
    this.storageAdapter,
  )

  private readonly commitAnalysisService = new CommitAnalysisService(
    this.commitRepository,
    this.analysisRepository,
  )
  private readonly reportGenerationService = new ReportGenerationService()

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

  private readonly analyzeCommand = new AnalyzeCommand(
    this.analyzeCommitsUseCase,
    this.commitAnalysisService,
    this.commitRepository,
  )
  private readonly reportCommand = new ReportCommand(this.generateReportUseCase)
  private readonly resumeCommand = new ResumeCommand(this.resumeAnalysisUseCase)

  private readonly controller = new CommitAnalysisController(
    this.analyzeCommand,
    this.reportCommand,
    this.resumeCommand,
  )

  private readonly application = new CLIApplication(this.controller)

  getApplication(): CLIApplication {
    return this.application
  }
}
