import os
import urllib.request
import urllib.error
import sqlite3

os.makedirs('public/calendarios', exist_ok=True)

# 1. Get all unique URLs from database
conn = sqlite3.connect('prisma/dev.db')
c = conn.cursor()
db_urls = [row[0] for row in c.execute("SELECT DISTINCT calendarUrl FROM Participant WHERE calendarUrl IS NOT NULL AND calendarUrl != ''")]
print(f"Found {len(db_urls)} distinct calendar URLs in DB.")

# 2. Also prepare candidates for a..z with roles
roles = ['participante', 'ist', 'cmt', 'responsable']
letters = [chr(i) for i in range(ord('a'), ord('z')+1)]
candidate_files = set()

for url in db_urls:
    if 'wsj2027cuota/' in url:
        filename = url.split('wsj2027cuota/')[-1].split('?')[0]
        if filename:
            candidate_files.add(filename)

for r in roles:
    for l in letters:
        candidate_files.add(f"{l}_{r}.jpg")
        candidate_files.add(f"{l}_{r}.png")
        candidate_files.add(f"{l}_{r}.pdf")

print(f"Total candidate files to test: {len(candidate_files)}")

downloaded = 0
failed = 0
found_files = []

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

for filename in sorted(candidate_files):
    url = f"https://www.gruposanagustin.cl/wsj2027cuota/{filename}"
    out_path = os.path.join('public/calendarios', filename)
    
    # If already downloaded and size > 0, skip
    if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
        found_files.append(filename)
        continue

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                content = response.read()
                # Check that it's not an html error page (like 404 disguised as 200)
                if content.startswith(b'<!DOCTYPE') or content.startswith(b'<html'):
                    continue
                with open(out_path, 'wb') as f:
                    f.write(content)
                found_files.append(filename)
                downloaded += 1
                print(f"Downloaded: {filename} ({len(content)} bytes)")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            print(f"HTTP {e.code} for {filename}")
    except Exception as e:
        # print(f"Error for {filename}: {e}")
        pass

print(f"\nDone! Downloaded {downloaded} new files. Total available locally: {len(found_files)}")
