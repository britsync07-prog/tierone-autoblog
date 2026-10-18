import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const key = process.env.INDEXNOW_KEY;

if (key && /^[a-zA-Z0-9_-]{8,128}$/.test(key)) {
  mkdirSync('public', { recursive: true });
  writeFileSync(join('public', `${key}.txt`), key, 'utf8');
  console.log(`IndexNow: Synced key file to public/${key}.txt`);
} else {
  console.log('IndexNow: No valid INDEXNOW_KEY found in environment (skipped static sync).');
}
