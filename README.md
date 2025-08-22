# Git Commit Analyzer

A TypeScript/Node.js program that analyzes git commits and generates categorized summaries using Claude CLI.

## Features

- Extract commit details (message, date, diff) from git repositories
- Categorize commits using LLM analysis into: `tweak`, `feature`, or `process`
- Generate CSV reports with year, category, summary, and description
- Support for batch processing multiple commits
- Robust error handling and validation

## Installation

```bash
npm install
npm run build
```

## Usage

### Default Behavior

When run without arguments, the program analyzes all commits authored by the current user:

```bash
# Analyze all your commits in the current repository
npx commit-analyzer

# Analyze your last 10 commits
npx commit-analyzer --limit 10

# Analyze commits by a specific user
npx commit-analyzer --author user@example.com
```

### Command Line Arguments

```bash
# Analyze specific commits
npx commit-analyzer abc123 def456 ghi789

# Read commits from file
npx commit-analyzer --file commits.txt

# Specify output file with default behavior
npx commit-analyzer --output analysis.csv --limit 20
```

### Options

- `-o, --output <file>`: Output CSV file (default: `output.csv`)
- `-f, --file <file>`: Read commit hashes from file (one per line)
- `-a, --author <email>`: Filter commits by author email (defaults to current user)
- `-l, --limit <number>`: Limit number of commits to analyze
- `-h, --help`: Display help
- `-V, --version`: Display version

### Input File Format

When using `--file`, create a text file with one commit hash per line:

```
abc123def456
def456ghi789
ghi789jkl012
```

## Output Format

The program generates a CSV file with the following columns:

- `year`: Year of the commit
- `category`: One of `tweak`, `feature`, or `process`
- `summary`: One-line description (max 80 characters)
- `description`: Detailed explanation (2-3 sentences)

## Requirements

- Node.js 18+ with TypeScript support
- Git repository (must be run within a git repository)
- Claude CLI installed and configured
- Valid git commit hashes

## Categories

- **tweak**: Minor adjustments, bug fixes, small improvements
- **feature**: New functionality, major additions
- **process**: Build system, CI/CD, tooling, configuration changes

## Error Handling

The program includes comprehensive error handling for:

- Invalid commit hashes
- Git repository validation
- LLM analysis failures
- File I/O errors
- Network connectivity issues

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Type checking
npm run typecheck
```

## Examples

```bash
# Analyze all your commits in the current repository
npx commit-analyzer

# Analyze your last 20 commits and save to custom file
npx commit-analyzer --limit 20 --output my_analysis.csv

# Analyze commits by a specific team member
npx commit-analyzer --author teammate@company.com --limit 50

# Analyze specific commits
git log --oneline -5 | cut -d' ' -f1 > recent_commits.txt
npx commit-analyzer --file recent_commits.txt --output recent_analysis.csv

# Quick analysis of your recent work
npx commit-analyzer --limit 10
```
