/**
 * CLI Setup
 *
 * Configure commander with all commands.
 */

import { Command } from 'commander';
import {
  createDetectCommand,
  createInfoCommand,
  createValidateCommand,
  createLossCommand,
  createExportCommand,
  createExtractAssetsCommand,
  createOptimizeCommand,
} from './commands/index.js';

// Read version from package.json
const VERSION = '0.1.0';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('cf')
    .description('Character Foundry CLI - inspect, validate, and convert AI character cards')
    .version(VERSION);

  // Register commands
  program.addCommand(createDetectCommand());
  program.addCommand(createInfoCommand());
  program.addCommand(createValidateCommand());
  program.addCommand(createLossCommand());
  program.addCommand(createExportCommand());
  program.addCommand(createExtractAssetsCommand());
  program.addCommand(createOptimizeCommand());

  return program;
}
