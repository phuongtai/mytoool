# dùng: pip install requests bs4
import os
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

def find_audio_urls_for_word(word):
    url = f"https://dictionary.cambridge.org/dictionary/english/{word}"
    r = requests.get(url, headers=HEADERS, timeout=10)
    if r.status_code != 200:
        return []
    doc = BeautifulSoup(r.text, "html.parser")
    urls = set()
    # 1) thẻ <source src="..."> bên trong <audio>
    for source in doc.select("audio source[src]"):
        src = source.get("src")
        if src:
            if src.startswith("/"):
                src = "https://dictionary.cambridge.org" + src
            urls.add(src)
    # 2) phần tử nút audio (data-src-mp3 attribute)
    for btn in doc.select(".audio_play_button, .audio") :
        mp3 = btn.get("data-src-mp3") or btn.get("data-src")
        if mp3:
            if mp3.startswith("/"):
                mp3 = "https://dictionary.cambridge.org" + mp3
            urls.add(mp3)
    # 3) fallback: tìm mọi .mp3 trong source HTML
    for txt in doc.find_all(string=True):
        if ".mp3" in txt:
            start = txt.find("http")
            if start != -1:
                cand = txt[start:].split(".mp3")[0] + ".mp3"
                urls.add(cand)
    return list(urls)

def download_file(url, dst_folder="audio"):
    os.makedirs(dst_folder, exist_ok=True)
    fname = url.split("/")[-1].split("?")[0]
    path = os.path.join(dst_folder, fname)
    if os.path.exists(path):
        return path
    r = requests.get(url, headers=HEADERS, timeout=15)
    if r.status_code == 200:
        with open(path, "wb") as f:
            f.write(r.content)
        return path
    return None

if __name__ == "__main__":
    words = ["missing", "dictionary", "explore"]  # thay bằng danh sách của bạn
    for w in words:
        audios = find_audio_urls_for_word(w)
        print(w, "->", audios)
        for a in audios:
            p = download_file(a)
            print("  saved:", p)