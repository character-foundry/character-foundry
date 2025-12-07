
import { readFileSync } from 'fs';
import { parseCard } from './packages/loader/src/loader';

// Hack: The loader imports from @character-foundry/core etc.
// We need to rely on tsconfig paths or just hope tsx handles it if configured right.
// But since it failed, the issue is likely how node resolves the sub-packages.
// 
// Actually, the error was "No 'exports' main defined". This means package.json in core is missing "main" or "exports".
// Let's check package.json of core first.


const filePath = '.test_cards/Absolute Mother (wedding).png';

try {
  console.log(`Reading ${filePath}...`);
  const buffer = readFileSync(filePath);
  const data = new Uint8Array(buffer);

  console.log('Parsing...');
  const result = parseCard(data, { extractAssets: true });

  console.log('Card Name:', result.card.data.name);
  console.log('Assets Found:', result.assets.length);
  
  result.assets.forEach(a => {
    console.log(`- ${a.name} (${a.path}) [${a.data.length} bytes]`);
  });

} catch (err) {
  console.error('Error:', err);
}
