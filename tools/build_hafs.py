#!/usr/bin/env python3
"""Build the Hafs 'an 'Asim data of Athman (v36).

Inputs
  * a SQLite file with a `words` table (surah_number, ayah_number, word_number,
    qpc_hafs, is_ayah_marker) holding the KFGQPC Hafs Uthmanic text that matches
    the font "KFGQPC HAFS Uthmanic Script" (e.g. assets/data/quran-data.sqlite).
  * tools/hafs-madani-meta.json: rub' al-hizb starts and page starts of the
    Madani mushaf (from quran_android's MadaniDataSource).
  * dist/assets/data.js for the Arabic surah names and Makki/Madani labels.

Outputs
  * dist/assets/hafs/quran.json  [[sura, aya, text + U+FBFF+aya marker], ...]
  * dist/assets/hafs/data.js     window.QURAN_DATA for Hafs: 60 hizbs, 240
    quarters (the app's base unit for Hafs), 114 surahs.

The verse text is copied unchanged except that the rub' sign (۞) is removed:
the app draws division markers itself from the quarter boundaries.
"""
import json, re, sqlite3, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
db = sys.argv[1] if len(sys.argv) > 1 else 'quran-data.sqlite'
meta = json.loads((ROOT / 'tools/hafs-madani-meta.json').read_text())

# Warsh data supplies names and revelation type (identical across riwayat).
warsh_js = (ROOT / 'dist/assets/data.js').read_text()
warsh = json.loads(warsh_js[warsh_js.index('{'):warsh_js.rindex('}') + 1])
names = {s['id']: (s['name'], s['revelation']) for s in warsh['surahs']}

con = sqlite3.connect(db)
verses = {}
for sura, aya, n, text, marker in con.execute(
        'select surah_number, ayah_number, word_number, qpc_hafs, is_ayah_marker '
        'from words order by word_number_all'):
    if marker:
        continue
    text = text.replace('۞', '').strip()
    if text:
        verses.setdefault((sura, aya), []).append(text)

order = sorted(verses)
assert len(order) == 6236, len(order)
for s, count in enumerate(meta['ayahsPerSura'], 1):
    assert (s, count) in verses and (s, count + 1) not in verses, s

quran = [[s, a, ' '.join(verses[(s, a)]) + ' ' + chr(0xFBFF + a)] for s, a in order]
index = {(s, a): i for i, (s, a) in enumerate(order)}

# Page of every verse from the page starts of the Madani mushaf.
page_starts = [tuple(p) for p in meta['pageStarts']]
page_of = {}
p = 0
for key in order:
    while p + 1 < len(page_starts) and key >= page_starts[p + 1]:
        p += 1
    page_of[key] = p + 1

def title(key, words=4):
    # The first hizb is named by Al-Fatiha's first ayah after the basmala.
    if key == (1, 1):
        key = (1, 2)
    return ' '.join(verses[key][:words])

quarters = [tuple(q) for q in meta['quarters']]
assert len(quarters) == 240
units = []
for q, start in enumerate(quarters):
    start_i = index[start]
    end_i = index[quarters[q + 1]] - 1 if q + 1 < len(quarters) else len(order) - 1
    end = order[end_i]
    hizb = q // 4 + 1
    units.append({
        'id': q + 1, 'hizb': hizb, 'pos': q % 4 + 1, 'juz': (hizb + 1) // 2,
        'title': title(start), 'sura': start[0], 'aya': start[1],
        'endSura': end[0], 'endAya': end[1], 'startIndex': start_i, 'endIndex': end_i,
        'startOffset': 0, 'endOffset': None, 'page': page_of[start],
        'endPage': page_of[end], 'partial': False,
    })

hizbs = []
for h in range(60):
    first, last = units[h * 4], units[h * 4 + 3]
    hizbs.append({'id': h + 1, 'juz': (h + 2) // 2, 'title': first['title'],
                  'sura': first['sura'], 'aya': first['aya'],
                  'endSura': last['endSura'], 'endAya': last['endAya'],
                  'page': first['page'], 'endPage': last['endPage']})

def unit_of(i):
    for u in units:
        if u['startIndex'] <= i <= u['endIndex']:
            return u['id']
    raise ValueError(i)

surahs = []
for s in range(1, 115):
    count = meta['ayahsPerSura'][s - 1]
    name, revelation = names[s]
    surahs.append({'id': s, 'name': name, 'ayahs': count, 'revelation': revelation,
                   'firstEighth': unit_of(index[(s, 1)]), 'lastEighth': unit_of(index[(s, count)]),
                   'page': meta['pageForSura'][s - 1]})

out = ROOT / 'dist/assets/hafs'
out.mkdir(parents=True, exist_ok=True)
(out / 'quran.json').write_text(json.dumps(quran, ensure_ascii=False, separators=(',', ':')))
data = {'riwaya': 'hafs', 'unitsPerHizb': 4, 'hizbs': hizbs, 'eighths': units, 'surahs': surahs}
(out / 'data.js').write_text('window.QURAN_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('hafs: %d verses, %d hizbs, %d quarters, %d surahs' % (len(quran), len(hizbs), len(units), len(surahs)))
