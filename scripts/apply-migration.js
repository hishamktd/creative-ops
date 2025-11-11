#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration(migrationFile) {
  console.log(`\nApplying migration: ${migrationFile}`);

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`Error: Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing SQL...');

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(async (err) => {
    // If exec_sql RPC doesn't exist, try direct SQL execution
    console.log('Trying direct SQL execution...');
    return await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ sql_query: sql })
    }).then(r => r.json());
  });

  if (error) {
    console.error('Error applying migration:', error);
    console.error('\n⚠️  Direct SQL execution failed. Please use one of these methods:\n');
    console.log('1. Copy the contents of the migration file and paste it into the Supabase SQL Editor:');
    console.log(`   ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql`);
    console.log('\n2. Or use the Supabase CLI:');
    console.log('   npx supabase link --project-ref ' + supabaseUrl.split('.')[0].replace('https://', ''));
    console.log('   npx supabase db push');
    process.exit(1);
  }

  console.log('✅ Migration applied successfully!');
}

const migrationFile = process.argv[2] || '005_fix_rls_infinite_recursion.sql';
applyMigration(migrationFile);
