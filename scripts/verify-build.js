#!/usr/bin/env node
/**
 * Build Verification Script
 *
 * Verifies that all packages correctly support both ESM and CJS imports.
 * This prevents regressions where builds accidentally break one module format.
 *
 * Usage:
 *   node scripts/verify-build.js
 *   pnpm verify-build
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const packagesDir = join(rootDir, 'packages');

// Packages to test (in dependency order)
const PACKAGES_TO_TEST = [
  'core',
  'schemas',
  'png',
  'charx',
  'voxta',
  'lorebook',
  'loader',
  'exporter',
  'normalizer',
  'tokenizers',
  'media',
  'federation',
];

// Key exports to verify per package
const PACKAGE_EXPORTS = {
  core: ['base64Encode', 'FoundryError', 'isFoundryError', 'streamingUnzipSync'],
  schemas: ['detectSpec', 'CardNormalizer', 'getV3Data'],
  png: ['extractFromPNG', 'embedIntoPNG', 'isPNG'],
  charx: ['readCharX', 'writeCharX', 'isCharX'],
  voxta: ['readVoxta', 'isVoxta'],
  lorebook: ['parseLorebook', 'extractLorebookRefs', 'convertLorebook'],
  loader: ['parseCard'],
  exporter: ['exportCard', 'checkExportLoss'],
  normalizer: ['normalize', 'denormalizeToV3', 'ccv2ToCCv3'],
  tokenizers: ['countTokens', 'countCardTokens', 'getTokenizer'],
  media: ['detectImageFormat', 'getImageDimensions'],
  federation: ['enableFederation'],
};

let passed = 0;
let failed = 0;
const failures = [];

function log(msg, isError = false) {
  if (isError) {
    console.error(`\x1b[31m${msg}\x1b[0m`);
  } else {
    console.log(msg);
  }
}

function logSuccess(msg) {
  console.log(`\x1b[32m${msg}\x1b[0m`);
}

async function testESM(packageName, distPath) {
  const exports = PACKAGE_EXPORTS[packageName] || [];
  const esmPath = join(distPath, 'index.js');

  if (!existsSync(esmPath)) {
    return { success: false, error: 'dist/index.js not found' };
  }

  try {
    // Dynamic import using file URL
    const fileUrl = pathToFileURL(esmPath).href;
    const module = await import(fileUrl);
    const moduleKeys = Object.keys(module);

    // Check that expected exports exist
    const missing = exports.filter(exp => !(exp in module));
    if (missing.length > 0) {
      return { success: false, error: `Missing exports: ${missing.join(', ')}` };
    }

    return { success: true, exports: moduleKeys.length };
  } catch (err) {
    return { success: false, error: err.message.slice(0, 150) };
  }
}

function testCJS(packageName, distPath) {
  const exports = PACKAGE_EXPORTS[packageName] || [];
  const cjsPath = join(distPath, 'index.cjs');

  if (!existsSync(cjsPath)) {
    return { success: false, error: 'dist/index.cjs not found' };
  }

  try {
    // Use execSync to run require in a CJS context
    const script = `
      const m = require('${cjsPath.replace(/\\/g, '\\\\')}');
      const keys = Object.keys(m);
      const expected = ${JSON.stringify(exports)};
      const missing = expected.filter(e => !(e in m));
      if (missing.length > 0) {
        console.error('MISSING:' + missing.join(','));
        process.exit(1);
      }
      console.log('OK:' + keys.length);
    `;

    const result = execSync(`node -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      encoding: 'utf-8',
      cwd: rootDir,
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const count = parseInt(result.trim().replace('OK:', ''), 10);
    return { success: true, exports: count };
  } catch (err) {
    const output = (err.stderr || err.stdout || err.message || '').toString();
    if (output.includes('MISSING:')) {
      const missing = output.split('MISSING:')[1]?.split('\n')[0]?.trim() || 'unknown';
      return { success: false, error: `Missing exports: ${missing}` };
    }
    return { success: false, error: output.slice(0, 150) };
  }
}

function checkPackageJson(pkgPath) {
  const pkgJsonPath = join(pkgPath, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    return { valid: false, error: 'package.json not found' };
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    const issues = [];

    // Check for required fields
    if (!pkg.main) issues.push('missing "main"');
    if (!pkg.module) issues.push('missing "module"');
    if (!pkg.exports) issues.push('missing "exports"');

    // Check exports structure
    if (pkg.exports && pkg.exports['.']) {
      const root = pkg.exports['.'];
      if (!root.import) issues.push('exports missing "import" condition');
      if (!root.require) issues.push('exports missing "require" condition');
    }

    return { valid: issues.length === 0, issues };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

async function verifyPackage(packageName) {
  const pkgPath = join(packagesDir, packageName);
  const distPath = join(pkgPath, 'dist');

  // Check package exists
  if (!existsSync(pkgPath)) {
    log(`  [SKIP] Package directory not found`, true);
    return;
  }

  // Check dist exists
  if (!existsSync(distPath)) {
    log(`  [FAIL] No dist/ folder - run pnpm build first`, true);
    failed++;
    failures.push({ package: packageName, format: 'build', error: 'No dist/ folder' });
    return;
  }

  // Check package.json has correct exports
  process.stdout.write(`  pkg:  `);
  const pkgCheck = checkPackageJson(pkgPath);
  if (pkgCheck.valid) {
    logSuccess(`OK`);
  } else if (pkgCheck.issues?.length > 0) {
    log(`WARN - ${pkgCheck.issues.join(', ')}`, false);
  } else {
    log(`FAIL - ${pkgCheck.error}`, true);
  }

  // Test ESM
  process.stdout.write(`  ESM:  `);
  const esmResult = await testESM(packageName, distPath);
  if (esmResult.success) {
    logSuccess(`OK (${esmResult.exports} exports)`);
    passed++;
  } else {
    log(`FAIL - ${esmResult.error}`, true);
    failed++;
    failures.push({ package: packageName, format: 'ESM', error: esmResult.error });
  }

  // Test CJS
  process.stdout.write(`  CJS:  `);
  const cjsResult = testCJS(packageName, distPath);
  if (cjsResult.success) {
    logSuccess(`OK (${cjsResult.exports} exports)`);
    passed++;
  } else {
    log(`FAIL - ${cjsResult.error}`, true);
    failed++;
    failures.push({ package: packageName, format: 'CJS', error: cjsResult.error });
  }
}

async function main() {
  console.log('');
  console.log('Build Verification - ESM and CJS Import Test');
  console.log('=============================================');
  console.log('');

  for (const pkg of PACKAGES_TO_TEST) {
    console.log(`@character-foundry/${pkg}:`);
    await verifyPackage(pkg);
    console.log('');
  }

  console.log('=============================================');

  if (failed === 0) {
    logSuccess(`All ${passed} tests passed!`);
    console.log('');
    process.exit(0);
  } else {
    log(`${failed} tests failed, ${passed} passed`, true);
    console.log('');
    console.log('Failures:');
    for (const f of failures) {
      log(`  - ${f.package} (${f.format}): ${f.error}`, true);
    }
    console.log('');
    process.exit(1);
  }
}

main().catch((err) => {
  log(`Unexpected error: ${err.message}`, true);
  process.exit(1);
});
