import { CLIOptions, CLIService } from "./cli"

export function getCliOptions(): CLIOptions {
  const options = CLIService.parseArguments()
  if (options.output) {
    options.output = CLIService.resolveOutputPath(
      options.output,
      options.outputDir,
    )
  }
  return options
}
