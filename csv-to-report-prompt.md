# LLM Prompt Template: CSV to Markdown Report Generation

This is the prompt template to be used by the LLM service to generate condensed
markdown reports from CSV commit analysis data.

## Prompt Template

```
Analyze the following CSV data containing git commit analysis results and generate a condensed markdown development summary report.

CSV DATA:
{csv_content}

INSTRUCTIONS:
1. Group the data by year (descending order, most recent first)
2. Within each year, group by category: Features, Process Improvements, and Tweaks & Bug Fixes
3. Consolidate similar items within each category to create readable summaries
4. Focus on what was accomplished rather than individual commit details
5. Use clear, professional language appropriate for stakeholders

CATEGORY MAPPING:
- "feature" → "Features" section
- "process" → "Processes" section  
- "tweak" → "Tweaks & Bug Fixes" section

CONSOLIDATION GUIDELINES:
- Group similar features together (e.g., "authentication system improvements")
- Combine related bug fixes (e.g., "resolved 8 authentication issues")
- Summarize process changes by theme (e.g., "CI/CD pipeline enhancements")
- Use bullet points for individual items within categories
- Aim for 3-7 bullet points per category per year
- Include specific numbers when relevant (e.g., "15 bug fixes", "3 new features")

OUTPUT FORMAT:
Generate a markdown report with this exact structure:

```markdown
# Development Summary Report

## Commit Analysis
- **Total Commits**: [X] commits across [YEAR_RANGE]
- **[MOST_RECENT_YEAR]**: [X] commits ([X] features, [X] process, [X] tweaks)
- **[PREVIOUS_YEAR]**: [X] commits ([X] features, [X] process, [X] tweaks)
- [Continue for each year in the data]

## [YEAR]
### Features
- [Consolidated feature summary 1]
- [Consolidated feature summary 2]
- [Additional features as needed]

### Processes
- [Consolidated process improvement 1]
- [Consolidated process improvement 2]
- [Additional process items as needed]

### Tweaks & Bug Fixes
- [Consolidated tweak/fix summary 1]
- [Consolidated tweak/fix summary 2]
- [Additional tweaks/fixes as needed]

## [PREVIOUS YEAR]
[Repeat structure for each year in the data]
```

QUALITY REQUIREMENTS:
- Keep summaries concise but informative
- Use active voice and clear language
- Avoid technical jargon where possible
- Ensure each bullet point represents meaningful work
- Make the report valuable for both technical and non-technical readers

Generate the markdown report now:
```

## Implementation Notes

This prompt should be used in the `MarkdownReportGenerator` service with the following approach:

1. **Input Processing**: Replace `{csv_content}` with the actual CSV data read from the input file
2. **LLM Call**: Send this prompt to the configured LLM (Claude, Gemini, etc.)
3. **Response Parsing**: Extract the markdown content from the LLM response
4. **File Output**: Write the generated markdown to the specified output file

### Error Handling
- If LLM returns malformed response, retry up to MAX_RETRIES times
- Validate that the response contains properly formatted markdown
- Ensure all years from the CSV data are represented in the output
- Handle edge cases like empty categories or single-item categories

### Response Validation
The generated report should:
- Start with "# Development Summary Report"
- Have year sections in descending chronological order
- Include all three category sections for each year (even if empty)
- Use proper markdown formatting with ## for years and ### for categories
- Contain bullet points (-) for individual items
