# Prompt for Git Commit Analysis Program

  Create a TypeScript/Node.js program that analyzes git commits and generates
  categorized summaries.

  The program should:

## Input Requirements

  - Accept a list of git commit hashes as input (command line arguments or file)
  - For each commit, extract the commit message, date, and diff

  Core Functionality:

  1. Git Integration:
     Use git show and git diff to get commit details and changes
  2. LLM Analysis:
     Send commit message + diff to the claude cli for categorization.
  3. CSV Export:
     Generate output with columns:
     year, category, summary, description

## LLM Prompt Template

  Analyze this git commit and provide a categorization:

  - COMMIT MESSAGE:
    {commit_message}
  - COMMIT DIFF:
    {diff_content}

  Based on the commit message and code changes, categorize this commit as one
  of:
  - "tweak":
    Minor adjustments, bug fixes, small improvements
  - "feature":
    New functionality, major additions
  - "process":
    Build system, CI/CD, tooling, configuration changes

  Provide:
  1. Category:
     [tweak|feature|process]
  2. Summary:
     One-line description (max 80 chars)
  3. Description:
     Detailed explanation (2-3 sentences)

  Format as JSON: 
  ```json
  { 
    "category": "...", 
    "summary": "...",
    "description": "..."
  }
  ```

### Technical Implementation

  - Use Node.js with TypeScript
  - Extract timestamp from git commit

  Output Format:

  CSV with headers:
  timestamp,category,summary,description

  The program should be robust, handle edge cases, and provide clear error
  messages for invalid commits or API failures.
