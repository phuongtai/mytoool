import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

def get_cambridge_audio(word: str):
    """
    Scrapes Cambridge Dictionary for the first available audio URL for a given word.
    Prioritizes US English if available, otherwise UK.
    """
    try:
        url = f"https://dictionary.cambridge.org/dictionary/english/{word}"
        r = requests.get(url, headers=HEADERS, timeout=5)
        if r.status_code != 200:
            return None
        
        doc = BeautifulSoup(r.text, "html.parser")
        
        # Strategy: Look for audio sources
        # We prefer "us" or "uk"
        
        audio_sources = []
        
        for source in doc.select("audio source[src]"):
            src = source.get("src")
            if src:
                if src.startswith("/"):
                    src = "https://dictionary.cambridge.org" + src
                audio_sources.append(src)
                
        # Also check buttons
        for btn in doc.select(".audio_play_button, .audio"):
            mp3 = btn.get("data-src-mp3") or btn.get("data-src")
            if mp3:
                 if mp3.startswith("/"):
                    mp3 = "https://dictionary.cambridge.org" + mp3
                 audio_sources.append(mp3)

        if not audio_sources:
            return None

        # Prefer US English (.mp3 and contains 'us_')
        for src in audio_sources:
            if "us_" in src and src.endswith(".mp3"):
                return src
        
        # Fallback to any MP3
        for src in audio_sources:
            if src.endswith(".mp3"):
                return src
                
        return audio_sources[0] if audio_sources else None
        
    except Exception as e:
        print(f"Cambridge scrape error for {word}: {e}")
        return None
