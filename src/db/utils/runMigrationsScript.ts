import fs from 'fs';
import path from 'path';
import { supabase } from '../config/supabase';

/**
 * Run migrations from a specified directory
 */
export async function runMigrations(directory = path.resolve('supabase', 'migrations')) {
  console.log(`Running migrations from ${directory}`);
  
  // Get all SQL files and sort them by name
  const files = fs
    .readdirSync(directory)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }
  
  console.log(`Found ${files.length} migration files.`);
  
  // Execute each migration in order
  for (const file of files) {
    try {
      console.log(`Running migration: ${file}`);
      const filePath = path.join(directory, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Execute the SQL using Supabase service role (admin)
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        console.error(`Error running migration ${file}:`, error);
        throw error;
      }
      
      console.log(`Migration ${file} completed successfully.`);
    } catch (error) {
      console.error(`Failed to run migration ${file}:`, error);
      throw error;
    }
  }
  
  console.log('All migrations completed successfully.');
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}
