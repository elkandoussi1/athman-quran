#!/usr/bin/env python3
"""Build the v37 data: Warsh->Hafs ayah map, Warsh reciter timings, bundled tafsirs.

Inputs (not stored in the repo):
  --warsh-db   quran_warsh.db  (Warsh verse timings for mp3quran.net recitations)
  --tafsir     a checkout of github.com/spa5k/tafsir_api (MIT)
"""
import argparse, json, os, re, sqlite3, difflib, unicodedata
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist', 'assets')

def skeleton(word):
    out = []
    for ch in unicodedata.normalize('NFKD', word):
        o = ord(ch)
        if unicodedata.category(ch) in ('Mn', 'Me'): continue
        if 0xFB50 <= o <= 0xFDFF or 0xFE70 <= o <= 0xFEFF:  # presentation forms
            ch = unicodedata.normalize('NFKC', ch)
        if 0x0600 <= o <= 0x0605 or 0x06D6 <= o <= 0x06ED or 0x08A0 <= o <= 0x08FF: continue
        ch = {'ٱ': '', 'ا': '', 'أ': '', 'إ': '', 'آ': '', 'ء': '', 'ى': 'ي', 'ئ': 'ي', 'ؤ': 'و', 'ة': 'ه', 'ـ': ''}.get(ch, ch)
        if 'ء' <= ch <= 'ي': out.append(ch)
    return ''.join(out)

def words(text):
    text = re.sub('[ﰀ-￿]', ' ', text)  # verse-number glyphs
    return [w for w in (skeleton(t) for t in text.replace('\xa0', ' ').split()) if w]

def build_map(warsh, hafs):
    """For every Warsh ayah return the Hafs ayah range that holds its words."""
    out = []
    for s in range(1, 115):
        wa = [(a, w) for (ss, a, t) in warsh if ss == s for w in words(t)]
        # Hafs 1:1 is the basmala: Warsh does not count it, so it never maps.
        ha = [(a, w) for (ss, a, t) in hafs if ss == s and not (s == 1 and a == 1) for w in words(t)]
        sm = difflib.SequenceMatcher(None, [w for _, w in wa], [w for _, w in ha], autojunk=False)
        owner = [None] * len(wa)
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == 'equal':
                for k in range(i2 - i1): owner[i1 + k] = ha[j1 + k][0]
            elif tag == 'replace':
                for k in range(i2 - i1):
                    j = j1 + min(j2 - j1 - 1, round(k * (j2 - j1) / max(1, i2 - i1)))
                    owner[i1 + k] = ha[j][0]
        count = max(a for (ss, a, _) in warsh if ss == s)
        spans = {}
        for (a, _), h in zip(wa, owner):
            if h is None: continue
            lo, hi = spans.get(a, (h, h)); spans[a] = (min(lo, h), max(hi, h))
        row = []
        for a in range(1, count + 1):
            lo, hi = spans.get(a) or (row[-1] if row else (1, 1)) if False else spans.get(a, (None, None))
            if lo is None:  # no words matched: reuse the neighbour
                prev = row[-1] if row else 1
                lo = hi = prev if isinstance(prev, int) else prev[1]
            row.append(lo if lo == hi else [lo, hi])
        # Keep the map monotone.
        out.append(row)
    return out

def build_timings(db):
    c = sqlite3.connect(db)
    ids = {r[0]: r for r in c.execute('select id,name_ar,name_en,folder_url from reciters')}
    res = {}
    for rid in ids:
        rows = list(c.execute('select v.surah,v.ayah,t.start_ms,t.end_ms from timings t join verses v on v.id=t.verse_id where t.reciter=? order by v.surah,v.ayah', (rid,)))
        surahs = [[] for _ in range(114)]
        for s, a, st, en in rows:
            surahs[s - 1] += [round(st / 10), round(en / 10)]
        res[rid] = {'folder': ids[rid][3], 'name': ids[rid][1], 'unit': 'cs', 'surahs': surahs}
    return res

def clean(text):
    return re.sub(r'\n{3,}', '\n\n', text.replace('\r', '')).strip()

def build_tafsir(src, slug, kind, counts):
    out = []
    for s in range(1, 115):
        data = json.load(open(os.path.join(src, 'tafsir', slug, f'{s}.json'), encoding='utf-8'))
        ayahs = data['ayahs'] if isinstance(data, dict) else data
        row = [''] * counts[s]
        intro = ''
        for x in ayahs:
            t = clean(x['text'])
            if kind == 'muyassar' and t.startswith('تسمية السورة'):
                head, sep, body = t.partition('[التفسير]')
                if not sep:  # some surahs lack the marker: the intro is the bullet list
                    paras = [x for x in re.split(r'\n\s*\n', t) if x.strip()]
                    last = max(i for i, x in enumerate(paras) if x.strip().startswith('•'))
                    head, body = '\n\n'.join(paras[:last + 1]), '\n\n'.join(paras[last + 1:])
                if not intro: intro = clean(head)
                t = clean(body)
            row[x['ayah'] - 1] = t
        # The Muyassar edition repeats an ayah group's text: keep the intro only once.
        out.append({'intro': intro, 'ayahs': row})
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--warsh-db', required=True)
    ap.add_argument('--tafsir', required=True)
    args = ap.parse_args()
    warsh = json.load(open(os.path.join(DIST, 'quran.json'), encoding='utf-8'))
    hafs = json.load(open(os.path.join(DIST, 'hafs', 'quran.json'), encoding='utf-8'))
    os.makedirs(os.path.join(DIST, 'audio'), exist_ok=True)
    m = build_map(warsh, hafs)
    json.dump(m, open(os.path.join(DIST, 'warsh-hafs.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    keys = {80: 'qazabri', 120: 'husary', 16: 'kouchi', 14: 'jazairi'}
    for rid, t in build_timings(args.warsh_db).items():
        assert sum(len(x) for x in t['surahs']) == 2 * len(warsh), rid
        for s in range(114):
            n = sum(1 for (ss, _, _) in warsh if ss == s + 1)
            assert len(t['surahs'][s]) == 2 * n, (rid, s)
        json.dump(t, open(os.path.join(DIST, 'audio', f'warsh-{keys[rid]}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    counts = {}
    for (ss, a, _) in hafs: counts[ss] = max(counts.get(ss, 0), a)
    for slug, key, kind in [('ar-tafsir-muyassar', 'muyassar', 'muyassar'), ('ar-tafsir-al-jalalayn', 'jalalayn', ''), ('al-muyassar-fi-al-gharib', 'gharib', '')]:
        d = os.path.join(DIST, 'tafsir', key); os.makedirs(d, exist_ok=True)
        for s, row in enumerate(build_tafsir(args.tafsir, slug, kind, counts), 1):
            json.dump(row, open(os.path.join(d, f'{s}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main()
