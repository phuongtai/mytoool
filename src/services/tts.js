const BACKEND_URL = '/api/tts';

// Simple in-memory cache to avoid re-fetching
const audioCache = new Map();

export const playTTS = async (text, voiceId = 'en-US-Journey-F', speed = 1) => {
  if (!text) return;

  const cacheKey = `${text}-${voiceId}-${speed}`;

  // 1. Check Memory Cache
  if (audioCache.has(cacheKey)) {
    const audio = audioCache.get(cacheKey);
    audio.currentTime = 0;
    audio.play().catch(e => console.error("Audio play error:", e));
    return;
  }

  // Fallback wrapper
  const fallbackToBrowser = () => {
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

  try {
    // 2. Call FastAPI Backend
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        voice_id: voiceId,
        speed: speed
      })
    });

    if (!response.ok) {
        throw new Error(`Backend Error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.url) throw new Error("No URL returned from backend");

    // 3. Play Audio from URL
    const audio = new Audio(data.url);
    
    // Save to Cache
    audioCache.set(cacheKey, audio);
    
    audio.play().catch(e => {
        console.error("Audio play error:", e);
        fallbackToBrowser();
    });

  } catch (error) {
    console.error("TTS Error:", error);
    fallbackToBrowser();
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
