import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const MIGRATIONS_DIR = './drizzle';

function updateMigrations() {
  const files = readdirSync(MIGRATIONS_DIR).filter(file => file.endsWith('.sql'));

  for (const file of files) {
    const filePath = join(MIGRATIONS_DIR, file);
    let content = readFileSync(filePath, 'utf-8');

    // Safely inject IF NOT EXISTS to prevent destructive failures on existing schemas
    content = content.replace(/CREATE TABLE (?!IF NOT EXISTS)/g, 'CREATE TABLE IF NOT EXISTS ');
    content = content.replace(/CREATE INDEX (?!IF NOT EXISTS)/g, 'CREATE INDEX IF NOT EXISTS ');
    content = content.replace(/CREATE UNIQUE INDEX (?!IF NOT EXISTS)/g, 'CREATE UNIQUE INDEX IF NOT EXISTS ');

    writeFileSync(filePath, content, 'utf-8');
    console.log(`[Migration Interceptor] Patched ${file} with IF NOT EXISTS`);
  }
}

try {
  console.log('[Migration Interceptor] Scanning Drizzle migrations...');
  updateMigrations();
  console.log('[Migration Interceptor] Applying remote migrations via Wrangler...');
  execSync('npx wrangler d1 migrations apply DB --remote', { stdio: 'inherit' });
  console.log('[Migration Interceptor] Remote migrations applied successfully.');
} catch (error) {
  console.error('[Migration Interceptor] Deployment halted due to migration failure:', error);
  process.exit(1);
}
