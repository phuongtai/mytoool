import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { getCambridgeAudio } from './cambridge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'audio_cache';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper: Generate cache filename (same logic as backend)
function getCacheFilename(text) {
  const hash = crypto.createHash('md5').update(text.toLowerCase()).digest('hex');
  return `${hash}.mp3`;
}

// Helper: Check if file exists in Supabase
async function checkCacheExists(filename) {
  const { data } = await supabase.storage
    .from(BUCKET_NAME)
    .list('', { search: filename });
  
  if (data && data.length > 0) {
    return data.some(f => f.name === filename);
  }
  return false;
}

// Helper: Upload to Supabase
async function uploadToSupabase(filename, buffer) {
  console.log(`Uploading ${filename}...`);
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(filename, buffer, {
    contentType: 'audio/mpeg',
    upsert: true
  });
  if (error) {
    console.error(`Upload Error for ${filename}:`, error);
    return false;
  }
  return true;
}

// Main function
async function prepareAudioCache() {
  // Load topics.json
  const topicsPath = path.join(__dirname, '..', 'src', 'data', 'topics.json');
  const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf-8'));

  // Collect all unique words
  const uniqueWords = new Set();
  
  topics.forEach(topic => {
    topic.steps?.forEach(step => {
      step.words?.forEach(item => {
        if (item.en) uniqueWords.add(item.en.toLowerCase().trim());
      });
    });
  });

  console.log(`Found ${uniqueWords.size} unique words to process`);

  let processed = 0;
  let cached = 0;
  let downloaded = 0;
  let failed = 0;

  for (const word of uniqueWords) {
    processed++;
    const filename = getCacheFilename(word);

    // Check if already cached
    if (await checkCacheExists(filename)) {
      cached++;
      console.log(`[${processed}/${uniqueWords.size}] ✓ Already cached: ${word}`);
      continue;
    }

    // Try to get from Cambridge
    console.log(`[${processed}/${uniqueWords.size}] Fetching: ${word}`);
    const camUrl = await getCambridgeAudio(word);
    
    if (!camUrl) {
      failed++;
      console.log(`[${processed}/${uniqueWords.size}] ✗ Not found on Cambridge: ${word}`);
      continue;
    }

    try {
      const resp = await axios.get(camUrl, { responseType: 'arraybuffer', timeout: 10000 });
      if (resp.status === 200) {
        const buffer = Buffer.from(resp.data);
        const uploaded = await uploadToSupabase(filename, buffer);
        if (uploaded) {
          downloaded++;
          console.log(`[${processed}/${uniqueWords.size}] ✓ Downloaded & uploaded: ${word}`);
        } else {
          failed++;
        }
      }
    } catch (e) {
      failed++;
      console.error(`[${processed}/${uniqueWords.size}] ✗ Download error for ${word}:`, e.message);
    }

    // Rate limiting: wait 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n=== Summary ===');
  console.log(`Total words: ${uniqueWords.size}`);
  console.log(`Already cached: ${cached}`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Failed: ${failed}`);
}

prepareAudioCache().catch(console.error);
