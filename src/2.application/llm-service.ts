import { CategoryType } from "@domain/category"

/**
 * Output port for LLM analysis operations
 */
export interface ILLMService {
  /**
   * Detects available LLM models on the system
   */
  detectAvailableModels(): Promise<string[]>

  /**
   * Sets the LLM model to use
   */
  setModel(model: string): void

  /**
   * Sets verbose mode for detailed logging
   */
  setVerbose(verbose: boolean): void

  /**
   * Analyzes commit content and returns structured analysis
   */
  analyzeCommit(
    message: string,
    diff: string,
  ): Promise<{
    category: CategoryType
    summary: string
    description: string
  }>

  /**
   * Gets the maximum number of retry attempts
   */
  getMaxRetries(): number

  /**
   * Generates sophisticated yearly summaries from CSV data using LLM
   * with consolidation, categorization, and stakeholder-friendly language
   */
  generateYearlySummariesFromCSV(csvContent: string): Promise<string>

  /**
   * Generates time-period-based summaries from CSV data using LLM
   */
  generateTimePeriodSummariesFromCSV(csvContent: string, period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'): Promise<string>

  /**
   * Checks if the service is available and configured
   */
  isAvailable(): Promise<boolean>
}
