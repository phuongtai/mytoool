const BACKEND_URL = '/api/tts';

// Simple in-memory cache to avoid re-fetching
const audioCache = new Map();

const fetchAudio = async (text, voiceId, speed) => {
  const cacheKey = `${text}-${voiceId}-${speed}`;

  // 1. Check Memory Cache
  if (audioCache.has(cacheKey)) {
    const audio = audioCache.get(cacheKey);
    audio.currentTime = 0;
    return audio;
  }

  // 2. Call Backend
  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice_id: voiceId, speed })
  });

  if (!response.ok) throw new Error(`Backend Error: ${response.status}`);

  const data = await response.json();
  if (!data.url) throw new Error("No URL returned from backend");

  // 3. Create Audio Object
  const audio = new Audio(data.url);
  audioCache.set(cacheKey, audio);
  
  // Pre-load the audio data
  audio.load();
  
  return audio;
};

export const preloadTTS = async (text, voiceId = 'en-US-Journey-F', speed = 1) => {
  if (!text) return;
  try {
    await fetchAudio(text, voiceId, speed);
  } catch (e) {
    // console.warn("Preload failed for:", text);
  }
};

export const playTTS = async (text, voiceId = 'en-US-Journey-F', speed = 1) => {
  if (!text) return;

  try {
    const audio = await fetchAudio(text, voiceId, speed);
    
    // Play with error handling
    try {
      await audio.play();
    } catch (e) {
      console.error("Audio play error:", e);
      fallbackToBrowser(text);
    }

  } catch (error) {
    console.error("TTS Error:", error);
    fallbackToBrowser(text);
  }
};

const fallbackToBrowser = (text) => {
  console.warn("Using browser fallback for TTS");
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.name.includes('Google US') || v.name.includes('Samantha') || v.lang.startsWith('en'));
    if (enVoice) utterance.voice = enVoice;
    window.speechSynthesis.speak(utterance);
  }
};

export const AVAILABLE_VOICES = [
  { id: 'en-US-Journey-F', name: 'Journey (Modern)', gender: 'Female' },
  { id: 'en-US-Journey-D', name: 'Journey (Deep)', gender: 'Male' },
  { id: 'en-US-Neural2-C', name: 'Neural (C)', gender: 'Female' },
  { id: 'en-US-Neural2-D', name: 'Neural (D)', gender: 'Male' },
  { id: 'en-US-Wavenet-C', name: 'WaveNet (C)', gender: 'Female' },
  { id: 'en-US-Wavenet-D', name: 'WaveNet (D)', gender: 'Male' }
];
