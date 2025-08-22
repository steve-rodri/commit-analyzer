export interface CommitInfo {
  hash: string
  message: string
  date: Date
  diff: string
  year: number
}

export interface LLMAnalysis {
  category: "tweak" | "feature" | "process"
  summary: string
  description: string
}

export interface AnalyzedCommit extends CommitInfo {
  analysis: LLMAnalysis
}

export interface CSVRow {
  year: number
  category: string
  summary: string
  description: string
}
