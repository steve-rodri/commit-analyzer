# Git Commit Analyzer

A TypeScript/Node.js program that analyzes git commits and generates categorized summaries using Claude CLI.

## Features

- Extract commit details (message, date, diff) from git repositories
- Categorize commits using LLM analysis into: `tweak`, `feature`, or `process`
- Generate CSV reports with year, category, summary, and description
- Support for batch processing multiple commits
- Automatically filters out merge commits for cleaner analysis
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
- LLM analysis failures with automatic retry
- File I/O errors
- Network connectivity issues

### Resume Capability

The tool automatically:
- Saves progress checkpoints every 10 commits
- Saves immediately when a failure occurs
- **Stops processing after a commit fails all retry attempts**
- Exports partial results to the CSV file before exiting

If the process stops (e.g., after 139 commits due to API failure), you can resume from where it left off:

```bash
# Resume from last checkpoint
npx commit-analyzer --resume

# Clear checkpoint and start fresh
npx commit-analyzer --clear

# View checkpoint status (it will prompt you)
npx commit-analyzer --resume
```

The checkpoint file (`.commit-analyzer-progress.json`) contains:
- List of all commits to process
- Successfully processed commits (including failed ones to skip on resume)
- Analyzed commit data (only successful ones)
- Output file location

**Important**: When a commit fails after all retries (default 3), the process stops immediately to prevent wasting API calls. The successfully analyzed commits up to that point are saved to the CSV file.

### Retry Logic

The tool includes automatic retry logic with exponential backoff for handling API failures when processing many commits. This is especially useful when analyzing large numbers of commits that might trigger rate limits.

#### Configuration

You can configure the retry behavior using environment variables:

- `LLM_MAX_RETRIES`: Maximum number of retry attempts (default: 3)
- `LLM_INITIAL_RETRY_DELAY`: Initial delay between retries in milliseconds (default: 5000)
- `LLM_MAX_RETRY_DELAY`: Maximum delay between retries in milliseconds (default: 30000)
- `LLM_RETRY_MULTIPLIER`: Multiplier for exponential backoff (default: 2)

#### Examples

```bash
# More aggressive retries for large batches (e.g., 139+ commits)
LLM_MAX_RETRIES=5 LLM_INITIAL_RETRY_DELAY=10000 npx commit-analyzer --limit 200

# Faster retries for testing
LLM_MAX_RETRIES=2 LLM_INITIAL_RETRY_DELAY=2000 npx commit-analyzer

# Conservative approach for rate-limited APIs
LLM_MAX_RETRIES=4 LLM_INITIAL_RETRY_DELAY=15000 LLM_MAX_RETRY_DELAY=60000 npx commit-analyzer
```

The retry mechanism automatically:
- Retries failed API calls with increasing delays
- Shows progress and retry attempts in the console
- Continues processing remaining commits even if some fail
- Reports the total number of successful and failed commits at the end

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
