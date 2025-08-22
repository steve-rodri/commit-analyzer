import { execSync } from "child_process"
import { CommitInfo, LLMAnalysis } from "./types"

export class LLMService {
  static async analyzeCommit(commit: CommitInfo): Promise<LLMAnalysis> {
    const prompt = this.buildPrompt(commit.message, commit.diff)

    try {
      const claudeOutput = execSync(`claude`, {
        input: prompt,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      })

      return this.parseResponse(claudeOutput)
    } catch (error) {
      throw new Error(
        `Failed to analyze commit ${commit.hash}: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  private static buildPrompt(commitMessage: string, diff: string): string {
    return `Analyze this git commit and provide a categorization:

COMMIT MESSAGE:
${commitMessage}

COMMIT DIFF:
${diff}

Based on the commit message and code changes, categorize this commit as one of:
- "tweak": Minor adjustments, bug fixes, small improvements
- "feature": New functionality, major additions
- "process": Build system, CI/CD, tooling, configuration changes

Provide:
1. Category: [tweak|feature|process]
2. Summary: One-line description (max 80 chars)
3. Description: Detailed explanation (2-3 sentences)

Format as JSON:
\`\`\`json
{
  "category": "...",
  "summary": "...",
  "description": "..."
}
\`\`\``
  }

  private static parseResponse(response: string): LLMAnalysis {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      if (!jsonMatch) {
        throw new Error("No JSON block found in response")
      }

      const parsed = JSON.parse(jsonMatch[1])

      if (!this.isValidCategory(parsed.category)) {
        throw new Error(`Invalid category: ${parsed.category}`)
      }

      if (!parsed.summary || !parsed.description) {
        throw new Error("Missing required fields in response")
      }

      return {
        category: parsed.category,
        summary: parsed.summary.substring(0, 80),
        description: parsed.description,
      }
    } catch (error) {
      throw new Error(
        `Failed to parse LLM response: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  private static isValidCategory(
    category: string,
  ): category is "tweak" | "feature" | "process" {
    return ["tweak", "feature", "process"].includes(category)
  }
}
