import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface CsvItem {
  Title: string;
  Type: 'movie' | 'tv';
  ID: string;
}

async function migrateCatalog(userId: string) {
  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY! // Note: This needs to be the service key, not the anon key
  );

  // Read and parse CSV file
  const csvPath = path.join(process.cwd(), 'src', 'data', 'personal-catalog.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  const records: CsvItem[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`Found ${records.length} items to migrate`);

  // Process items in batches to avoid overwhelming the database
  const BATCH_SIZE = 50;
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(records.length / BATCH_SIZE)}`);
    
    await Promise.all(batch.map(async (item) => {
      try {
        // Check if item already exists
        const { data: existing } = await supabase
          .from('personal_catalog')
          .select('id')
          .eq('user_id', userId)
          .eq('media_id', parseInt(item.ID))
          .single();

        if (existing) {
          console.log(`Skipping ${item.Title} (already exists)`);
          results.skipped++;
          return;
        }

        // Add new item
        const { error } = await supabase
          .from('personal_catalog')
          .insert([
            {
              user_id: userId,
              media_id: parseInt(item.ID),
              title: item.Title,
              type: item.Type.toLowerCase(),
              added_at: new Date().toISOString(),
            },
          ]);

        if (error) {
          throw error;
        }

        results.success++;
        console.log(`Successfully migrated: ${item.Title}`);
      } catch (error) {
        results.failed++;
        console.error(`Failed to migrate ${item.Title}:`, error);
      }
    }));

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < records.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\nMigration completed:');
  console.log(`✅ Successfully migrated: ${results.success} items`);
  console.log(`⏭️  Skipped (already exist): ${results.skipped} items`);
  console.log(`❌ Failed to migrate: ${results.failed} items`);
}

// Check for required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Error: Required environment variables are missing.');
  console.error('Please ensure you have set:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_KEY (this should be the service role key, not the anon key)');
  process.exit(1);
}

// Get user ID from command line argument
const userId = process.argv[2];
if (!userId) {
  console.error('Error: Please provide your user ID as a command line argument.');
  console.error('Usage: npm run migrate-catalog YOUR_USER_ID');
  process.exit(1);
}

// Run the migration
migrateCatalog(userId)
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 