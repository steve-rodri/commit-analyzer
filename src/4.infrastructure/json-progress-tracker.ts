import { Analysis } from "@domain/analysis"
import { AnalyzedCommit } from "@domain/analyzed-commit"
import { Category } from "@domain/category"
import { Commit } from "@domain/commit"
import { CommitHash } from "@domain/commit-hash"

import { ConsoleFormatter } from "@presentation/console-formatter"
import {
  IProgressRepository,
  ProgressState,
} from "@presentation/progress-repository.interface"
import { IStorageService } from "@presentation/storage-service.interface"

import { calculatePercentage } from "../utils"
import { AppPaths } from "../utils/app-paths"

export class JSONProgressTracker implements IProgressRepository {
  private static readonly JSON_INDENT = 2

  constructor(private readonly storageService: IStorageService) {}

  private getProgressFilePath(): string {
    return AppPaths.getProgressFilePath()
  }

  async saveProgress(state: ProgressState): Promise<void> {
    const serializedState = this.serializeProgressState(state)
    const content = JSON.stringify(
      serializedState,
      null,
      JSONProgressTracker.JSON_INDENT,
    )
    await this.storageService.writeFile(
      this.getProgressFilePath(),
      content,
    )
  }

  async loadProgress(): Promise<ProgressState | null> {
    if (!(await this.hasProgress())) {
      return null
    }

    try {
      const content = await this.storageService.readFile(
        this.getProgressFilePath(),
      )
      const serializedState = JSON.parse(content)
      return this.deserializeProgressState(serializedState)
    } catch (error) {
      ConsoleFormatter.logError(`Failed to load progress file: ${error}`)
      return null
    }
  }

  async hasProgress(): Promise<boolean> {
    return this.storageService.fileExists(this.getProgressFilePath())
  }

  async clearProgress(): Promise<void> {
    await this.storageService.deleteFile(this.getProgressFilePath())
  }

  getRemainingCommits(state: ProgressState): CommitHash[] {
    const processedHashes = new Set(
      state.processedCommits.map((hash) => hash.getValue()),
    )
    return state.totalCommits.filter(
      (hash) => !processedHashes.has(hash.getValue()),
    )
  }

  formatProgressSummary(state: ProgressState): string {
    const processed = state.processedCommits.length
    const total = state.totalCommits.length
    const remaining = total - processed
    const percentComplete = calculatePercentage(processed, total)

    return `
      Previous session:
      - Started: ${state.startTime.toLocaleString()}
      - Progress: ${processed}/${total} commits (${percentComplete}%)
      - Remaining: ${remaining} commits
      - Output file: ${state.outputFile}
    `.trim()
  }

  private serializeProgressState(
    state: ProgressState,
  ): Record<string, unknown> {
    return {
      totalCommits: state.totalCommits.map((hash) => hash.getValue()),
      processedCommits: state.processedCommits.map((hash) => hash.getValue()),
      analyzedCommits: state.analyzedCommits.map((commit) => ({
        hash: commit.getHash().getValue(),
        message: commit.getMessage(),
        date: commit.getDate().toISOString(),
        year: commit.getYear(),
        category: commit.getAnalysis().getCategory().getValue(),
        summary: commit.getAnalysis().getSummary(),
        description: commit.getAnalysis().getDescription(),
      })),
      lastProcessedIndex: state.lastProcessedIndex,
      startTime: state.startTime.toISOString(),
      outputFile: state.outputFile,
    }
  }

  private deserializeProgressState(
    data: Record<string, unknown>,
  ): ProgressState {
    this.validateProgressData(data)

    return {
      totalCommits: (data.totalCommits as string[]).map((hash: string) =>
        CommitHash.create(hash),
      ),
      processedCommits: (data.processedCommits as string[]).map(
        (hash: string) => CommitHash.create(hash),
      ),
      analyzedCommits: this.deserializeAnalyzedCommits(
        data.analyzedCommits as Record<string, unknown>[],
      ),
      lastProcessedIndex: data.lastProcessedIndex as number,
      startTime: new Date(data.startTime as string),
      outputFile: data.outputFile as string,
    }
  }

  private validateProgressData(data: Record<string, unknown>): void {
    if (!Array.isArray(data.totalCommits)) {
      throw new Error("Invalid progress data: totalCommits must be an array")
    }

    if (!Array.isArray(data.processedCommits)) {
      throw new Error(
        "Invalid progress data: processedCommits must be an array",
      )
    }

    if (typeof data.lastProcessedIndex !== "number") {
      throw new Error(
        "Invalid progress data: lastProcessedIndex must be a number",
      )
    }

    if (typeof data.startTime !== "string") {
      throw new Error("Invalid progress data: startTime must be a string")
    }

    if (typeof data.outputFile !== "string") {
      throw new Error("Invalid progress data: outputFile must be a string")
    }
  }

  private deserializeAnalyzedCommits(
    data: Record<string, unknown>[],
  ): AnalyzedCommit[] {
    if (!Array.isArray(data)) {
      return []
    }

    return data.map((item: Record<string, unknown>) => {
      const hash = CommitHash.create(item.hash as string)
      const commit = new Commit(
        hash,
        item.message as string,
        new Date(item.date as string),
        "", // We don't store diff in progress, so use empty string
      )

      const category = Category.create(item.category as string)
      const analysis = new Analysis(
        category,
        item.summary as string,
        item.description as string,
      )

      return new AnalyzedCommit(commit, analysis)
    })
  }
}
