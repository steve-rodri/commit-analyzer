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

import { CachedAnalysisRepository } from "@infra/cached-analysis-repository"
import { CacheService } from "@infra/cache-service"
import { FileStorageRepository } from "@infra/file-storage-repository"
import { FileSystemStorageAdapter } from "@infra/file-system-storage-adapter"
import { GitAdapter } from "@infra/git-adapter"
import { GitCommitRepository } from "@infra/git-commit-repository"
import { JSONProgressTracker } from "@infra/json-progress-tracker"
import { LLMAdapterFactory } from "@infra/llm-adapter-factory"
import { LLMAnalysisRepository } from "@infra/llm-analysis-repository"

export interface DIContainerOptions {
  llm?: string
  noCache?: boolean
}

export class DIContainer {
  private readonly gitAdapter = new GitAdapter()
  private readonly llmAdapter = LLMAdapterFactory.create(this.options?.llm)
  private readonly storageAdapter = new FileSystemStorageAdapter()
  private readonly cacheService = (() => {
    const service = new CacheService()
    if (this.options?.noCache) {
      service.setCacheEnabled(false)
    }
    return service
  })()
  private readonly progressTracker = new JSONProgressTracker(
    this.storageAdapter,
  )

  private readonly commitRepository = new GitCommitRepository(this.gitAdapter)
  private readonly llmAnalysisRepository = new LLMAnalysisRepository(
    this.llmAdapter,
  )
  private readonly analysisRepository = this.options?.noCache
    ? this.llmAnalysisRepository
    : new CachedAnalysisRepository(this.llmAnalysisRepository, this.cacheService)
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
    this.progressTracker,
  )

  private readonly application = new CLIApplication(this.controller)

  constructor(private readonly options?: DIContainerOptions) {}

  getApplication(): CLIApplication {
    return this.application
  }
}

