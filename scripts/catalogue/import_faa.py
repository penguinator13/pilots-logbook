"""Extract FAA JO 7360.1K Appendix A using PDF row rules and columns."""
import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
import pymupdf

URL = 'https://www.faa.gov/documentLibrary/media/Order/FAA_Order_JO_7360.1K_Aircraft_Type_Designators.pdf'
CATEGORIES = {'Fixed-wing': 'fixed-wing', '@Fixed-wing': 'fixed-wing', '$Fixed-wing': 'fixed-wing', 'Helicopter': 'helicopter', 'Gyroplane': 'gyroplane', 'Powered-lift': 'powered-lift'}
# Exact malformed Appendix A strings, corroborated in Appendix B (PDF pages).
ALIAS_CORRECTIONS = {
    ('A109', 'AGUSTA. A-109 Grand'): ('AGUSTA', 'A-109 Grand', 130),
    ('A30B', 'AIRBUS. A-300B2-200'): ('AIRBUS', 'A-300B2-200', 133),
    ('BE80', 'BEECH. 80 Queen Air'): ('BEECH', '80 Queen Air', 147),
    ('GAZL', 'SOKO. SA-341 Partizan'): ('SOKO', 'SA-341 Partizan', 259),
    ('PRET', 'GM&T Pretty Flight'): ('GM&T', 'Pretty Flight', 191),
}

ENGINES = {'T': 'turbine', 'P': 'piston', 'J': 'jet', 'E': 'electric', 'R': 'rocket', 'C': 'coupled-propeller'}

def build_catalog(pdf):
    pdf = Path(pdf)
    doc = pymupdf.open(pdf)
    cover = doc[0].get_text()
    if 'JO 7360.1K' not in cover or '06/12/2025' not in cover:
        raise ValueError('Only verified JO 7360.1K effective 06/12/2025 layout is supported')
    records, issues, seen_codes = [], [], []
    for page in doc:
        text = page.get_text()
        if not re.search(r'Appendix\s+A\b', text) or page.number < 8:
            continue
        words = page.get_text('words')
        rules = sorted(set(round(d['rect'].y0, 2) for d in page.get_drawings()
                           if d['rect'].x0 < 73 and d['rect'].x1 > 110 and d['rect'].height < 2 and d['rect'].y0 > 110))
        if not rules:
            raise ValueError(f'No row boundaries on PDF page {page.number+1}')
        # The double horizontal header rule is not a data row.
        rules = [y for i, y in enumerate(rules) if i == len(rules)-1 or rules[i+1]-y > 1.1]
        rules.append(720)
        for top, bottom in zip(rules, rules[1:]):
            row = [w for w in words if top <= (w[1]+w[3])/2 < bottom]
            def col(left, right):
                return ' '.join(w[4] for w in sorted(row, key=lambda w: (round(w[1], 0), w[0])) if left <= w[0] < right).strip()
            raw_code = col(72, 113)
            if not raw_code:
                continue
            code = raw_code.rstrip('*')
            category = col(113, 158)
            if category not in CATEGORIES:
                issues.append({'page': page.number+1, 'icao': raw_code, 'reason': 'special designator or unsupported category', 'rawCategory': category})
                continue
            if not re.fullmatch(r'[A-Z0-9]{2,4}', code):
                raise ValueError(f'Invalid code {raw_code!r}')
            engine = col(158, 194)
            match = re.fullmatch(r'(\d+|C)([A-Z])/(?:[A-Z]\+?)?', engine)
            if not match or match[2] not in ENGINES:
                raise ValueError(f'Invalid engine cell {code}: {engine!r}')
            wake = col(194, 241).lower()
            if wake not in ('light', 'medium', 'heavy', 'super', 'light/medium', ''):
                raise ValueError(f'Invalid ICAO wake cell {code}: {wake!r}')
            seen_codes.append(code)
            aliases = [w for w in row if w[0] >= 322]
            lines = {}
            for w in aliases:
                key = round(w[1], 0)
                lines.setdefault(key, []).append(w)
            for _, line in sorted(lines.items()):
                alias = ' '.join(w[4] for w in sorted(line, key=lambda w:w[0]))
                correction = ALIAS_CORRECTIONS.get((code, alias))
                if correction:
                    manufacturer, model, evidence_page = correction
                    if model not in doc[evidence_page-1].get_text():
                        raise ValueError(f'Alias correction evidence missing: {code} {alias}')
                    issues.append({'page': page.number+1, 'icao': code, 'reason': 'source punctuation resolved against Appendix B', 'text': alias, 'evidencePdfPage': evidence_page})
                elif ',' in alias:
                    manufacturer, model = (s.strip() for s in alias.split(',', 1))
                else:
                    raise ValueError(f'Unresolved alias on page {page.number+1}: {code} {alias}')
                if not manufacturer or not model:
                    issues.append({'page': page.number+1, 'icao': code, 'reason': 'empty alias field', 'text': alias})
                    continue
                records.append({'icao': code, 'manufacturer': manufacturer, 'model': model, 'category': CATEGORIES[category], 'engineCount': 2 if match[1] == 'C' else int(match[1]), 'engineType': ENGINES[match[2]], 'wakeCategory': wake or None})
    unique = {tuple(r.values()):r for r in records}
    aircraft = sorted(unique.values(), key=lambda r:(r['icao'],r['manufacturer'],r['model']))
    return {'source': {'title':'Aircraft Type Designators', 'publisher':'Federal Aviation Administration', 'edition':'JO 7360.1K', 'effectiveDate':'2025-06-12', 'url':URL, 'sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(), 'scope':'Appendix A factual aircraft rows; one record per published manufacturer/model alias', 'wakeCategorySystem':'ICAO WTC (not FAA weight class or CWT)', 'rightsCaveat':'FAA factual table attribution; no assertion that every element of the PDF is unrestricted.', 'statistics':{'aircraftRows':len(aircraft),'distinctDesignators':len({r['icao'] for r in aircraft}), 'sourceDesignatorRows':len(seen_codes),'duplicateAliasesRemoved':len(records)-len(aircraft),'categories':dict(sorted(Counter(r['category'] for r in aircraft).items()))}, 'extractionIssues':issues}, 'aircraft':aircraft}

def validate_catalog(data):
    """Reject duplicate aliases, invalid/header rows, and misleading statistics."""
    rows = data['aircraft']
    keys = [(r['icao'], r['manufacturer'], r['model']) for r in rows]
    if len(keys) != len(set(keys)):
        raise ValueError('Duplicate aircraft alias')
    fields = {'icao','manufacturer','model','category','engineCount','engineType','wakeCategory'}
    for r in rows:
        if (set(r) != fields or not re.fullmatch(r'[A-Z0-9]{2,4}', r['icao'])
            or r['icao'] in {'BALL','GLID','GYRO','PARA','SHIP','UHEL','ULAC','ZZZZ'}
            or not r['manufacturer'] or not r['model']
            or r['category'] not in CATEGORIES.values()
            or type(r['engineCount']) is not int or r['engineCount'] < 1
            or r['engineType'] not in ENGINES.values()
            or r['wakeCategory'] not in {None,'light','medium','heavy','super','light/medium'}):
            raise ValueError(f'Invalid aircraft row: {r}')
    stats = data['source']['statistics']
    if stats['aircraftRows'] != len(rows) or stats['distinctDesignators'] != len({r['icao'] for r in rows}) or stats['categories'] != dict(Counter(r['category'] for r in rows)):
        raise ValueError('Count statistics disagree with records')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf', type=Path, default=Path(__file__).parent.parent/'faa7360.pdf')
    parser.add_argument('--output', type=Path, default=Path(__file__).parent/'aircraft-reference.json')
    args = parser.parse_args()
    result = build_catalog(args.pdf)
    validate_catalog(result)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(result['source']['statistics'], indent=2))
    print('Extraction issues:',len(result['source']['extractionIssues']))
