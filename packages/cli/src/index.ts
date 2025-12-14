/**
 * @character-foundry/cli
 *
 * CLI tool for inspecting, validating, and converting AI character cards.
 */

import { createCLI } from './cli.js';

// Create and run the CLI
const cli = createCLI();
cli.parse();
