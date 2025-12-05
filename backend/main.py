import os
import hashlib
import requests
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client
from cambridge import get_cambridge_audio

# Load env from parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Config
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GOOGLE_API_KEY = os.getenv("VITE_GOOGLE_CLOUD_API_KEY")
print(GOOGLE_API_KEY)
BUCKET_NAME = "audio_cache"

# Initialize Supabase (handle missing keys gracefully)
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY and "INSERT" not in SUPABASE_URL:
    try:
        # Debug: Check key role
        try:
             # Basic JWT decode without validation just to check the payload 'role'
             parts = SUPABASE_KEY.split(".")
             if len(parts) == 3:
                 import json
                 payload = json.loads(base64.b64decode(parts[1] + "==").decode("utf-8"))
                 print(f"[DEBUG] Supabase Key Role: {payload.get('role')}")
                 if payload.get('role') != 'service_role':
                     print("WARNING: You are using the ANON key. Uploads will fail! Use SERVICE_ROLE key.")
        except Exception as e:
             print(f"[DEBUG] Could not decode key: {e}")

        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Attempt to create the bucket if it doesn't exist
        try:
             print(f"Checking bucket '{BUCKET_NAME}'...")
             buckets = supabase.storage.list_buckets()
             exists = any(b.name == BUCKET_NAME for b in buckets)
             if not exists:
                 print(f"Creating bucket '{BUCKET_NAME}'...")
                 supabase.storage.create_bucket(BUCKET_NAME, options={"public": True})
             else:
                 print(f"Bucket '{BUCKET_NAME}' exists.")
        except Exception as e:
             print(f"Bucket init warning (might involve permissions): {e}")

    except Exception as e:
        print(f"Supabase Init Error: {e}")

class TTSRequest(BaseModel):
    text: str
    voice_id: str = "en-US-Journey-F"
    speed: float = 1.0

def get_audio_url(filename: str) -> str:
    """Returns a signed URL for the file (valid for 10 years)"""
    if not supabase: return ""
    try:
        # Create signed URL valid for ~10 years
        res = supabase.storage.from_(BUCKET_NAME).create_signed_url(filename, 315360000)
        # res is typically {'signedURL': '...'} or similar response object
        if isinstance(res, dict) and 'signedURL' in res:
             return res['signedURL']
        # Handle cases where it might just return the URL string directly (depending on lib version)
        return str(res) if res else ""
    except Exception as e:
        print(f"Sign URL error: {e}")
        return ""

def check_cache_exists(filename: str) -> bool:
    """Checks if file exists using list() on the private bucket"""
    if not supabase: return False
    try:
        # storage3 list() signature is list(path=None, options=None, ...)
        # We search for the exact filename
        res = supabase.storage.from_(BUCKET_NAME).list(path="", options={"search": filename})
        # If response is a list and has items with name == filename
        if isinstance(res, list):
             for item in res:
                 if isinstance(item, dict) and item.get('name') == filename:
                     return True
        return False
    except Exception as e:
        print(f"Cache Check Error: {e}")
        return False

def upload_to_supabase(filename: str, data: bytes, content_type: str = "audio/mpeg") -> Optional[str]:
    """Uploads bytes and returns Signed URL"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        print(f"Uploading {filename}...")
        supabase.storage.from_(BUCKET_NAME).upload(
            path=filename,
            file=data,
            file_options={"content-type": content_type, "upsert": "true"}
        )
        return get_audio_url(filename)
    except Exception as e:
        print(f"Upload Error: {e}")
        return None

def get_cache_filename(text: str, voice_id: str, speed: float) -> str:
    """Generates consistent filename based on text and params"""
    is_single_word = len(text.split()) == 1 and text.isalpha()
    if is_single_word:
         hash_key = hashlib.md5(text.lower().encode()).hexdigest()
    else:
         hash_key = hashlib.md5(f"{text}-{voice_id}-{speed}".encode()).hexdigest()
    return f"{hash_key}.mp3"

def download_from_supabase(filename: str) -> Optional[bytes]:
    """Downloads file bytes from Supabase"""
    if not supabase: return None
    try:
        data = supabase.storage.from_(BUCKET_NAME).download(filename)
        return data
    except Exception as e:
        return None

def get_audio_bytes(text: str, voice_id: str, speed: float) -> Optional[bytes]:
    """
    Core Logic:
    1. Check Cache (Download)
    2. If 2 words -> Recursively get W1 + W2 -> Concat -> Upload
    3. If single word -> Cambridge
    4. Fallback -> Google TTS
    5. Upload & Return
    """
    text = text.strip()
    if not text: return None

    filename = get_cache_filename(text, voice_id, speed)

    # 1. Try Cache Download
    # Given we have check_cache_exists, use it to avoid 404 logs?
    # Or just try download.
    # To be consistent with old logic:
    if check_cache_exists(filename):
        print(f"Cache HIT (Bytes): {filename}")
        return download_from_supabase(filename)

    print(f"Cache MISS (Bytes): {filename}")

    # 2. Two-Word Logic (The User Request)
    words = text.split()
    if len(words) == 2:
        print(f"Attempting 2-word concat for: '{text}'")
        b1 = get_audio_bytes(words[0], voice_id, speed)
        b2 = get_audio_bytes(words[1], voice_id, speed)
        
        if b1 and b2:
            print(f"Concat success for: '{text}'")
            combined = b1 + b2
            upload_to_supabase(filename, combined)
            return combined

    # 3. Generate New Audio (Cambridge or Google)
    audio_data = None
    is_single_word = len(words) == 1 and text.isalpha()

    # A. Cambridge
    if is_single_word:
        print(f"Trying Cambridge for: {text}")
        cambridge_url = get_cambridge_audio(text.lower())
        if cambridge_url:
            try:
                r = requests.get(cambridge_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
                if r.status_code == 200:
                    audio_data = r.content
                    print("Cambridge Success")
            except Exception as e:
                print(f"Cambridge Download Error: {e}")

    # B. Google TTS
    if not audio_data:
        print(f"Using Google Cloud TTS for: '{text}'")
        if not GOOGLE_API_KEY or "INSERT" in GOOGLE_API_KEY:
             print("Google API Key missing/invalid")
             return None
             
        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={GOOGLE_API_KEY}"
        payload = {
            "input": {"text": text},
            "voice": {"languageCode": "en-US", "name": voice_id},
            "audioConfig": {"audioEncoding": "MP3", "speakingRate": speed, "volumeGainDb": 6.0}
        }
        
        try:
            r = requests.post(url, json=payload, timeout=15)
            if r.status_code != 200:
                print(f"Google TTS Error: {r.text}")
                return None
            
            data = r.json()
            if "audioContent" in data:
                audio_data = base64.b64decode(data["audioContent"])
            else:
                print("No audio content from Google")
        except Exception as e:
            print(f"Google Req Error: {e}")
            return None

    # 4. Upload & Return
    if audio_data:
        upload_to_supabase(filename, audio_data)
        return audio_data

    return None

@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is empty")

    filename = get_cache_filename(text, req.voice_id, req.speed)
    
    # 1. Fast Path: Check Cache First (Head)
    if check_cache_exists(filename):
         print(f"Endpoint Cache HIT: {filename}")
         return {"url": get_audio_url(filename)}

    # 2. Generate (returns bytes and uploads)
    result_bytes = get_audio_bytes(text, req.voice_id, req.speed)
    
    if result_bytes:
         # It is now uploaded.
         return {"url": get_audio_url(filename)}
    
    raise HTTPException(status_code=500, detail="Failed to generate audio")

@app.get("/")
def health_check():
    return {"status": "ok", "supabase": supabase is not None}
