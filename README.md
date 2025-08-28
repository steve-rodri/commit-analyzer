# Git Commit Analyzer

A TypeScript/Node.js program that analyzes git commits and generates categorized summaries using Claude CLI.

## Features

- Extract commit details (message, date, diff) from git repositories
- Categorize commits using LLM analysis into: `tweak`, `feature`, or `process`
- Generate CSV reports with year, category, summary, and description
- Generate condensed markdown reports from CSV data for stakeholder communication
- Support for multiple LLM models (Claude, Gemini, Codex) with automatic detection
- Support for batch processing multiple commits
- Automatically filters out merge commits for cleaner analysis
- Robust error handling and validation

## Prerequisites

This tool requires Bun runtime. Install it globally:

```bash
# Install bun globally
curl -fsSL https://bun.sh/install | bash
# or
npm install -g bun
```

## Installation

```bash
npm install
bun link
```

After linking, you can use `commit-analyzer` command globally.

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

# Generate markdown report from existing CSV
npx commit-analyzer --report --input-csv analysis.csv

# Analyze commits and generate both CSV and markdown report
npx commit-analyzer --report --limit 50

# Use specific LLM model
npx commit-analyzer --llm claude --limit 10
```

### Options

- `-o, --output <file>`: Output file (default: `results/commits.csv` for analysis, `results/report.md` for reports)
- `--output-dir <dir>`: Output directory for CSV and report files (default: current directory)
- `-f, --file <file>`: Read commit hashes from file (one per line)
- `-a, --author <email>`: Filter commits by author email (defaults to current user)
- `-l, --limit <number>`: Limit number of commits to analyze
- `--llm <model>`: LLM model to use (claude, gemini, openai)
- `-r, --resume`: Resume from last checkpoint if available
- `-c, --clear`: Clear any existing progress checkpoint
- `--report`: Generate condensed markdown report from existing CSV
- `--input-csv <file>`: Input CSV file to read for report generation
- `-v, --verbose`: Enable verbose logging (shows detailed error information)
- `--since <date>`: Only analyze commits since this date (YYYY-MM-DD, '1 week ago', '2024-01-01')
- `--until <date>`: Only analyze commits until this date (YYYY-MM-DD, '1 day ago', '2024-12-31')
- `--no-cache`: Disable caching of analysis results
- `--batch-size <number>`: Number of commits to process per batch (default: 1 for sequential processing)
- `-h, --help`: Display help
- `-V, --version`: Display version

### Input File Format

When using `--file`, create a text file with one commit hash per line:

```
abc123def456
def456ghi789
ghi789jkl012
```

## Output Formats

### CSV Output

The program generates a CSV file with the following columns:

- `year`: Year of the commit
- `category`: One of `tweak`, `feature`, or `process`
- `summary`: One-line description (max 80 characters)
- `description`: Detailed explanation (2-3 sentences)

### Markdown Report Output

When using the `--report` option, the program generates a condensed markdown report that:

- Groups commits by year (most recent first)
- Organizes by categories: Features, Processes, Tweaks & Bug Fixes
- Consolidates similar items for stakeholder readability
- Includes commit count statistics
- Uses professional language suitable for both technical and non-technical audiences

## Requirements

- Node.js 18+ with TypeScript support (Bun runtime recommended)
- Git repository (must be run within a git repository)
- At least one supported LLM CLI tool:
  - Claude CLI (`claude`) - recommended, defaults to Sonnet model
  - Gemini CLI (`gemini`)
  - OpenAI CLI (`openai`)
- Valid git commit hashes (when specifying commits manually)

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

The checkpoint file (`.commit-analyzer/progress.json`) contains:
- List of all commits to process
- Successfully processed commits (including failed ones to skip on resume)
- Analyzed commit data (only successful ones)
- Output file location

**Important**: When a commit fails after all retries (default 3), the process stops immediately to prevent wasting API calls. The successfully analyzed commits up to that point are saved to the CSV file.

### Application Data Directory

The tool creates a `.commit-analyzer/` directory to store internal files:

```
.commit-analyzer/
├── progress.json        # Progress checkpoint data
└── cache/              # Cached analysis results
    ├── commit-abc123.json
    ├── commit-def456.json
    └── ...
```

- **Progress checkpoint**: Enables resuming interrupted analysis sessions
- **Analysis cache**: Stores LLM analysis results to avoid re-processing the same commits (TTL: 30 days)

Use `--no-cache` to disable caching if needed.

### Date Filtering

The tool supports flexible date filtering using natural language or specific dates:

```bash
# Analyze commits from the last week
npx commit-analyzer --since "1 week ago"

# Analyze commits from a specific date range
npx commit-analyzer --since "2024-01-01" --until "2024-12-31"

# Analyze commits from the beginning of the year
npx commit-analyzer --since "2024-01-01"

# Analyze commits up to a specific date
npx commit-analyzer --until "2024-06-30"
```

Date formats supported:
- Relative dates: `"1 week ago"`, `"2 months ago"`, `"3 days ago"`
- ISO dates: `"2024-01-01"`, `"2024-12-31"`
- Git-style dates: Any format accepted by `git log --since` and `git log --until`

### Batch Processing

Control processing speed and resource usage with batch size options:

```bash
# Process commits one at a time (default, safest for rate limits)
npx commit-analyzer --batch-size 1

# Process multiple commits in parallel (faster but may hit rate limits)
npx commit-analyzer --batch-size 5 --limit 100

# Sequential processing for large datasets
npx commit-analyzer --batch-size 1 --limit 500
```

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

# Generate both CSV and markdown report from analysis
npx commit-analyzer --report --limit 100 --output yearly_analysis.csv

# Generate only a markdown report from existing CSV
npx commit-analyzer --report --input-csv existing_analysis.csv --output team_report.md

# Use specific LLM model for analysis
npx commit-analyzer --llm gemini --limit 25

# Resume interrupted analysis with progress tracking
npx commit-analyzer --resume
```
