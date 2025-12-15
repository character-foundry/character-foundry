#!/usr/bin/env node

/**
 * Check that all published packages have consistent dependency versions.
 * Run this BEFORE pushing to catch version mismatches.
 *
 * Usage: node scripts/check-published-deps.js
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const PACKAGES = [
  'core', 'schemas', 'png', 'charx', 'voxta', 'lorebook',
  'loader', 'exporter', 'normalizer', 'tokenizers', 'media',
  'cli', 'federation', 'app-framework'
];

const FOUNDATIONAL = ['schemas', 'core'];

async function getPublishedDeps(pkg) {
  try {
    const result = execSync(`pnpm view @character-foundry/${pkg} dependencies --json 2>/dev/null`, {
      encoding: 'utf-8'
    });
    return JSON.parse(result || '{}');
  } catch {
    return {};
  }
}

function getLocalVersion(pkg) {
  try {
    const pkgJson = JSON.parse(
      readFileSync(join(process.cwd(), 'packages', pkg, 'package.json'), 'utf-8')
    );
    return pkgJson.version;
  } catch {
    return null;
  }
}

async function main() {
  console.log('Checking published dependency versions...\n');

  const issues = [];
  const foundationalVersions = {};

  // Get local versions of foundational packages
  for (const pkg of FOUNDATIONAL) {
    foundationalVersions[pkg] = getLocalVersion(pkg);
    console.log(`Local @character-foundry/${pkg}: ${foundationalVersions[pkg]}`);
  }
  console.log('');

  // Check each package's published deps
  for (const pkg of PACKAGES) {
    if (FOUNDATIONAL.includes(pkg)) continue;

    const deps = await getPublishedDeps(pkg);
    const localVersion = getLocalVersion(pkg);

    for (const [depName, depVersion] of Object.entries(deps)) {
      if (!depName.startsWith('@character-foundry/')) continue;

      const depPkg = depName.replace('@character-foundry/', '');
      if (!FOUNDATIONAL.includes(depPkg)) continue;

      const expectedVersion = `^${foundationalVersions[depPkg]}`;

      if (depVersion !== expectedVersion) {
        issues.push({
          package: pkg,
          localVersion,
          dependency: depPkg,
          published: depVersion,
          expected: expectedVersion
        });
      }
    }
  }

  if (issues.length === 0) {
    console.log('✅ All published packages have consistent dependency versions.\n');
    process.exit(0);
  }

  console.log('❌ Found dependency version mismatches:\n');

  const needsBump = new Set();

  for (const issue of issues) {
    console.log(`  ${issue.package}@${issue.localVersion}`);
    console.log(`    └─ ${issue.dependency}: published ${issue.published}, expected ${issue.expected}`);
    needsBump.add(issue.package);
  }

  console.log('\n📦 Packages that need version bump:');
  for (const pkg of needsBump) {
    console.log(`  - packages/${pkg}/package.json`);
  }

  console.log('\n⚠️  Bump these packages and republish before downstream can use new versions.');
  process.exit(1);
}

main().catch(console.error);
