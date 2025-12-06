import axios from 'axios';
import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

export async function getCambridgeAudio(word) {
  try {
    const url = `https://dictionary.cambridge.org/dictionary/english/${word}`;
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 5000 });
    
    const $ = cheerio.load(data);
    const audioSources = [];

    // Strategy 1: <audio> <source src="...">
    $('audio source[src]').each((_, el) => {
      let src = $(el).attr('src');
      if (src) {
        if (src.startsWith('/')) src = `https://dictionary.cambridge.org${src}`;
        audioSources.push(src);
      }
    });

    // Strategy 2: Buttons with data-src
    $('.audio_play_button, .audio').each((_, el) => {
      let src = $(el).attr('data-src-mp3') || $(el).attr('data-src');
      if (src) {
        if (src.startsWith('/')) src = `https://dictionary.cambridge.org${src}`;
        audioSources.push(src);
      }
    });

    if (audioSources.length === 0) return null;

    // Filter Logic
    // 1. Prefer US English (us_) and .mp3
    const usMp3 = audioSources.find(s => s.includes('us_') && s.endsWith('.mp3'));
    if (usMp3) return usMp3;

    // 2. Fallback to any MP3
    const anyMp3 = audioSources.find(s => s.endsWith('.mp3'));
    if (anyMp3) return anyMp3;

    return audioSources[0];
  } catch (error) {
    console.error(`Cambridge scrape error for ${word}:`, error.message);
    return null;
  }
}
