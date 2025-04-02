// This file aggregates all migrations for easier importing

import path from 'path';
import fs from 'fs';

// Get all migration files
const migrationDir = __dirname;
const migrationFiles = fs.readdirSync(migrationDir)
  .filter(file => file.endsWith('.sql'))
  .sort();

// Export mapping of migration names to their contents
export const migrations = migrationFiles.reduce((acc, file) => {
  const fileContent = fs.readFileSync(path.join(migrationDir, file), 'utf8');
  const name = path.basename(file, '.sql');
  acc[name] = fileContent;
  return acc;
}, {} as Record<string, string>);

// Export a function to run all migrations
export async function runMigrations(executeSql: (sql: string) => Promise<any>) {
  for (const name of Object.keys(migrations)) {
    try {
      await executeSql(migrations[name]);
      console.log(`Migration ${name} completed successfully`);
    } catch (error) {
      console.error(`Error running migration ${name}:`, error);
      throw error;
    }
  }
}
