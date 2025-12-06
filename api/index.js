import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';
import { getCambridgeAudio } from './cambridge.js';

// Load env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8081;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_API_KEY = process.env.VITE_GOOGLE_CLOUD_API_KEY;
const BUCKET_NAME = 'audio_cache';

// Initialize Supabase
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('Supabase Initialized');
}

// Helpers
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

const getAudioUrl = async (filename) => {
  if (!supabase) return '';
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filename, 315360000); // 10 years
  if (error || !data) {
    console.error('Sign URL error:', error);
    return '';
  }
  return data.signedUrl;
};

const checkCacheExists = async (filename) => {
  if (!supabase) return false;
  // list() in JS returns { data, error }
  const { data } = await supabase.storage
    .from(BUCKET_NAME)
    .list('', { search: filename });
    
  if (data && data.length > 0) {
    return data.some(f => f.name === filename);
  }
  return false;
};

const downloadFromSupabase = async (filename) => {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET_NAME).download(filename);
  if (error || !data) return null;
  // data is a Blob in Node/browser, convert to Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const uploadToSupabase = async (filename, buffer) => {
  if (!supabase) return null;
  console.log(`Uploading ${filename}...`);
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(filename, buffer, {
    contentType: 'audio/mpeg',
    upsert: true
  });
  if (error) {
    console.error('Upload Error:', error);
    return null;
  }
  return getAudioUrl(filename);
};

// Core Logic
const getAudioBytes = async (text, voiceId, speed) => {
  text = text.trim();
  if (!text) return null;

  const filename = getCacheFilename(text, voiceId, speed);

  // 1. Try Cache
  if (await checkCacheExists(filename)) {
    console.log(`Cache HIT: ${filename}`);
    return downloadFromSupabase(filename);
  }

  console.log(`Cache MISS: ${filename}`);

  // 2. Generate (Cambridge or Google)
  let audioBuffer = null;
  const words = text.split(/\s+/);
  const isSingleWord = words.length === 1 && /^[a-zA-Z]+$/.test(text);

  // A. Cambridge
  if (isSingleWord) {
    const camUrl = await getCambridgeAudio(text.toLowerCase());
    if (camUrl) {
      try {
        const resp = await axios.get(camUrl, { responseType: 'arraybuffer', timeout: 10000 });
        if (resp.status === 200) {
          audioBuffer = Buffer.from(resp.data);
        }
      } catch (e) {
        console.error('Cambridge Download Error:', e.message);
      }
    }
  }

  // B. Google TTS
  if (!audioBuffer) {
    if (!GOOGLE_API_KEY) {
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
        audioBuffer = Buffer.from(resp.data.audioContent, 'base64');
      }
    } catch (e) {
      console.error('Google TTS Error:', e.response?.data || e.message);
    }
  }

  // 4. Upload & Return
  if (audioBuffer) {
    await uploadToSupabase(filename, audioBuffer);
    return audioBuffer;
  }

  return null;
};

// Route
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice_id = 'en-US-Journey-F', speed = 1.0 } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is empty' });

    const filename = getCacheFilename(text.trim(), voice_id, speed);

    // Fast Path: Check Cache First logic
    if (await checkCacheExists(filename)) {
       const url = await getAudioUrl(filename);
       return res.json({ url });
    }

    const buffer = await getAudioBytes(text.trim(), voice_id, speed);
    if (!buffer) {
       return res.status(500).json({ error: 'Failed to generate audio' });
    }

    const url = await getAudioUrl(filename);
    return res.json({ url });

  } catch (error) {
    console.error('TTS Handler Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', engine: 'node' });
});


// Serve static files from 'dist' in production
if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC) {
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));

    // Handle SPA routing
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}


// Export for Vercel
export default app;

// Local Development
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Node Backend running on http://localhost:${PORT}`);
  });
}
