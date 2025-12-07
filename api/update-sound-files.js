import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Setup Environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_API_KEY = process.env.VITE_GOOGLE_CLOUD_API_KEY;
const BUCKET_NAME = 'audio_cache';
const DEFAULT_VOICE_ID = 'en-US-Journey-F';
const DEFAULT_SPEED = 1.0;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper: Generate cache filename (MUST MATCH api/index.js)
const getCacheFilename = (text, voiceId, speed) => {
  const isSingleWord = text.split(' ').length === 1 && /^[a-zA-Z]+$/.test(text);
  let hashStr = '';
  if (isSingleWord) {
    hashStr = text.toLowerCase();
  } else {
    hashStr = `${text}-${voiceId}-${speed}`;
  }
  return crypto.createHash('md5').update(hashStr).digest('hex') + '.mp3';
};

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

// Helper: Generate Audio via Google TTS
async function generateAudio(text, voiceId, speed) {
  if (!GOOGLE_API_KEY) {
      console.error("Missing Google API Key");
      return null;
  }

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`;
  const payload = {
    input: { text },
    voice: { languageCode: 'en-US', name: voiceId },
    audioConfig: { audioEncoding: 'MP3', speakingRate: speed, volumeGainDb: 6.0 }
  };

  try {
    const resp = await axios.post(url, payload, { timeout: 15000 });
    if (resp.data.audioContent) {
      return Buffer.from(resp.data.audioContent, 'base64');
    }
  } catch (e) {
    console.error(`Google TTS Error for "${text}":`, e.response?.data || e.message);
  }
  return null;
}

async function updateSoundFiles() {
  console.log('Fetching items from database...');
  // Fetch all items
  const { data: items, error } = await supabase.from('items').select('id, english, sound_file');
  
  if (error) {
    console.error('Error fetching items:', error);
    return;
  }

  console.log(`Found ${items.length} items to process.`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
     if (!item.english) {
         skipped++;
         continue;
     }

     const text = item.english.trim();
     const expectedFilename = getCacheFilename(text, DEFAULT_VOICE_ID, DEFAULT_SPEED);

     // Check if we need to update DB (if filename is different or missing)
     const dbNeedsUpdate = item.sound_file !== expectedFilename;
     
     // Check if file exists in Storage
     const fileExists = await checkCacheExists(expectedFilename);
     
     if (!fileExists) {
        console.log(`Generating audio for: "${text}"...`);
        const buffer = await generateAudio(text, DEFAULT_VOICE_ID, DEFAULT_SPEED);
        if (buffer) {
            const uploaded = await uploadToSupabase(expectedFilename, buffer);
            if (!uploaded) {
                console.error(`Failed to upload audio for: ${text}`);
                failed++;
                continue;
            }
        } else {
            console.error(`Failed to generate audio for: ${text}`);
            failed++;
            continue;
        }
        // Rate limit kindness
        await new Promise(r => setTimeout(r, 200)); 
     }

     if (dbNeedsUpdate || !fileExists) { // Update DB if it was wrong OR if we just created the file (implies we should ensure DB is sync)
         console.log(`Updating DB for item ${item.id} -> ${expectedFilename}`);
         const { error: updateError } = await supabase
            .from('items')
            .update({ sound_file: expectedFilename })
            .eq('id', item.id);
            
         if (updateError) {
             console.error(`Failed to update DB for item ${item.id}`, updateError);
             failed++;
         } else {
             updated++;
         }
     } else {
         skipped++;
     }
  }

  console.log('\n=== Summary ===');
  console.log(`Total: ${items.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
}

updateSoundFiles().catch(console.error);
