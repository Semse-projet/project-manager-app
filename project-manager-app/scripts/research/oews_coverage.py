#!/usr/bin/env python3
"""SEMSE T-005 research-only OEWS release coverage audit; never derives billable rates.
Usage: python oews_coverage.py --state oesm25st.zip --metro oesm25ma.zip --out DIR
Requires only Python 3.11+ stdlib. No network, credentials or production access.
"""
import argparse, csv, hashlib, io, json, re, zipfile
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
from xml.etree import ElementTree as ET

RELEASE = 'May 2025'
STATE_LIST = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split()
STATE_NAMES = dict(zip(STATE_LIST, 'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia'.split('|')))
STATE_BY_NAME = {v.upper(): k for k, v in STATE_NAMES.items()}
SOC = {
 'bathroom':'47-2152 47-2044 47-2031 47-2111', 'carpentry':'47-2031',
 'cleaning':'37-2011 37-2012', 'concrete':'47-2051 47-2073 47-2171',
 'deck':'47-2031 47-2061', 'demolition':'47-2061 47-4041',
 'drywall':'47-2081 47-2082', 'electrical':'47-2111',
 'fencing':'47-4031 47-2031', 'flooring':'47-2041 47-2042 47-2043 47-2044',
 'hvac':'49-9021 47-2211 47-2111', 'insulation':'47-2131 47-2132',
 'kitchen':'47-2031 47-2152 47-2111 47-2044',
 'labor':'47-2061 47-3010', 'landscaping':'37-3011 37-3013',
 'masonry':'47-2021 47-2022', 'painting':'47-2141',
 'plumbing':'47-2152 47-2151', 'project-manager':'11-9021 47-1011',
 'roofing':'47-2181', 'siding':'47-2031 47-2211',
 'solar':'47-2231 47-2111', 'tile':'47-2044', 'windows-doors':'47-2121 47-2031',
}
SOC = {k: v.split() for k, v in SOC.items()}
assert len(STATE_LIST) == 51 and len(SOC) == 24

MAIN = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
SUPPRESSED = {'', '*', '#', '**', '***', '-', 'N/A', 'NA', 'NULL'}

def normalized(x): return re.sub(r'[^A-Z0-9]+', '_', str(x or '').strip().upper()).strip('_')
def parse_wage(x):
    t = str(x or '').strip().upper().replace(',', '')
    if t in SUPPRESSED: return None
    try:
        d = Decimal(t)
        return str(d) if d.is_finite() and d > 0 else None
    except InvalidOperation: return None

def col_idx(cell_ref):
    letters = re.match(r'[A-Z]+', cell_ref or '')
    n = 0
    for c in letters.group(0) if letters else 'A': n = 26*n + ord(c)-64
    return n-1

def xlsx_rows(blob):
    """Read ordinary XLSX rows without external dependencies or macros/formulas."""
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            shared = [''.join(t.text or '' for t in el.iter(MAIN+'t')) for el in root.findall(MAIN+'si')]
        sheets = sorted((n for n in z.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+\.xml', n)),
                        key=lambda s: int(re.search(r'sheet(\d+)', s).group(1)))
        if not sheets: raise ValueError('No XLSX worksheet')
        for sheet in sheets:
            with z.open(sheet) as src:
                for _, elem in ET.iterparse(src, events=('end',)):
                    if elem.tag != MAIN+'row': continue
                    cells = {}
                    for c in elem.findall(MAIN+'c'):
                        v = c.find(MAIN+'v')
                        inline = c.find(MAIN+'is')
                        raw = v.text if v is not None else ''.join(t.text or '' for t in inline.iter(MAIN+'t')) if inline is not None else ''
                        if c.attrib.get('t') == 's' and raw:
                            raw = shared[int(raw)]
                        cells[col_idx(c.attrib.get('r'))] = raw or ''
                    if cells: yield [cells.get(i, '') for i in range(max(cells)+1)]
                    elem.clear()

def records(path):
    path = Path(path)
    if not path.exists(): raise FileNotFoundError(path)
    if path.suffix.lower() == '.csv':
        with path.open(newline='', encoding='utf-8-sig') as f:
            yield from csv.reader(f)
    elif path.suffix.lower() == '.xlsx':
        yield from xlsx_rows(path.read_bytes())
    elif path.suffix.lower() == '.zip':
        with zipfile.ZipFile(path) as z:
            members = [n for n in z.namelist() if n.lower().endswith('.xlsx') and not n.startswith('__MACOSX/')]
            if not members: raise ValueError('Expected an XLSX file inside the OEWS ZIP')
            # One unambiguous workbook only; do not silently select a random source.
            if len(members) != 1: raise ValueError(f'Ambiguous OEWS ZIP: {len(members)} XLSX workbooks')
            yield from xlsx_rows(z.read(members[0]))
    else: raise ValueError('Input must be ZIP, XLSX or CSV')

def read_oews(path, kind):
    if kind not in ('state', 'metro'): raise ValueError('OEWS kind must be state or metro')
    data, meta = {}, Counter()
    header = None
    for values in records(path):
        candidate = [normalized(v) for v in values]
        if {'OCC_CODE', 'AREA', 'H_MEDIAN'}.issubset(candidate):
            # Duplicate normalized headings overwrite earlier values in dict(zip).
            # Reject ambiguous columns instead of silently selecting a wage.
            if len(set(candidate)) != len(candidate):
                repeated = sorted(k for k in set(candidate) if candidate.count(k) > 1)
                raise ValueError(f'Duplicate OEWS header fields: {repeated}')
            header = candidate
            meta['headers_detected'] += 1
            scope_fields = {'AREA_TYPE', 'NAICS', 'I_GROUP', 'OWN_CODE', 'O_GROUP'}
            present = scope_fields.intersection(candidate)
            meta['scope_fields_present'] = len(present)
            # Reject missing grain dimensions from XLSX/ZIP, not just from the
            # data rows: otherwise an incomplete workbook silently inflates
            # cross-industry/state/SOC coverage. CSV without scope is limited
            # to synthetic research fixtures and is never source-authenticated.
            if Path(path).suffix.lower() in ('.zip', '.xlsx') and present != scope_fields:
                missing = ', '.join(sorted(scope_fields - present))
                raise ValueError(f'OEWS XLSX/ZIP required scope fields missing: {missing}')
            continue
        if header is None: continue
        item = dict(zip(header, values))
        soc = str(item.get('OCC_CODE','')).strip()
        if not re.fullmatch(r'\d{2}-\d{4}', soc): continue
        meta['soc_rows_seen'] += 1

        # The OEWS area and industry dimensions are not interchangeable.
        # A cross-industry reference is not an industry-specific wage, and a
        # major/broad occupation is not a detailed SOC wage observation.
        expected_area_types = ('2',) if kind == 'state' else ('4', '6')
        if 'AREA_TYPE' in header and str(item.get('AREA_TYPE','')).strip() not in expected_area_types:
            meta['skipped_wrong_geography'] += 1
            continue
        if 'NAICS' in header and str(item.get('NAICS','')).strip().zfill(6) != '000000':
            meta['skipped_non_cross_industry'] += 1
            continue
        if 'I_GROUP' in header and normalized(item.get('I_GROUP')) != 'CROSS_INDUSTRY':
            meta['skipped_non_cross_industry'] += 1
            continue
        if 'OWN_CODE' in header and str(item.get('OWN_CODE','')).strip() != '1235':
            meta['skipped_ownership_scope'] += 1
            continue
        if 'O_GROUP' in header and normalized(item.get('O_GROUP')) != 'DETAILED':
            meta['skipped_non_detailed_occupation'] += 1
            continue
        if kind == 'state':
            label = str(item.get('AREA_TITLE','')).strip().upper()
            location = STATE_BY_NAME.get(label)
            if not location:
                # Only accept USPS state code if state-level AREA_TITLE is not available.
                candidate_state = str(item.get('PRIM_STATE') or item.get('STATE') or '').upper().strip()
                if candidate_state in STATE_NAMES and not label: location = candidate_state
            if not location: continue
            title = STATE_NAMES[location]
        else:
            area = str(item.get('AREA','')).strip()
            title = str(item.get('AREA_TITLE','')).strip()
            if not area or not title: continue
            location = area
        key = (location, soc)
        if key in data:
            meta['duplicate_keys'] += 1
            # A duplicate grain could mean multiple ownership groups/industries.
            # Fail closed instead of silently taking a last-seen rate.
            raise ValueError(f'Duplicate {kind} area/SOC key: {key}')
        m = parse_wage(item.get('H_MEAN'))
        med = parse_wage(item.get('H_MEDIAN'))
        p25 = parse_wage(item.get('H_PCT25'))
        p75 = parse_wage(item.get('H_PCT75'))
        data[key] = {'area_title': title, 'mean':m, 'median':med, 'p25':p25, 'p75':p75}
        if med is None: meta['missing_or_suppressed_median'] += 1
    if header is None: raise ValueError('OEWS required headers OCC_CODE, AREA, H_MEDIAN not found')
    if not data: raise ValueError(f'No valid {kind} rows (release/area schema mismatch)')
    meta['unique_keys'] = len(data)
    return data, dict(meta)

def coverage(data, kind):
    areas = STATE_LIST if kind=='state' else sorted({a for a, _ in data})
    # BLS suppressions/omissions can exclude the first candidate SOC for a
    # trade. An area title must come from any matching area record, not from
    # a particular occupation, otherwise metro rows lose their area label.
    titles = {area: row['area_title'] for (area, _), row in data.items()}
    for area in areas:
        for trade, codes in SOC.items():
            present = [soc for soc in codes if (area, soc) in data and data[(area,soc)]['median'] is not None]
            status = 'ALL_REFERENCE_WAGES_PRESENT' if len(present)==len(codes) else 'SOME_REFERENCE_WAGES_PRESENT' if present else 'NO_REFERENCE_WAGES'
            yield [kind,area,titles.get(area, STATE_NAMES.get(area,'')),trade,len(codes),len(present),len(codes)-len(present),status]

def save_csv(path, rows):
    with open(path,'w',newline='',encoding='utf-8') as f:
        writer=csv.writer(f)
        writer.writerow(['kind','area_code','area_title_hint','trade','mapped_soc_count','median_available_soc_count','missing_or_suppressed_count','reference_status'])
        writer.writerows(rows)

def run(state,metro,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    manifest={'release_claim':'May 2025','release_verified':False,
              'source_authentication':'NOT_VERIFIED_OFFLINE',
              'classification':'RESEARCH_ONLY_NOT_APPROVED',
              'notes':'Input filename and checksum alone do not prove the BLS release. Wages are employee reference, never billable rates or commercial certification',
              'input':{}}
    validated_rows = {}
    # Validate BOTH sources before emitting any new report files. If the
    # second input fails, do not leave a fresh state CSV that looks complete.
    for kind,path in [('state',state),('metro',metro)]:
        records_by_key, stats=read_oews(path,kind)
        rows=list(coverage(records_by_key,kind))
        validated_rows[kind] = rows
        counts=Counter(r[-1] for r in rows)
        observed_areas = sorted({area for area, _ in records_by_key})
        manifest['input'][kind]={
            'filename':Path(path).name,
            'sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),
            'stats':stats,
            'trade_area_grid_rows':len(rows),
            'trade_area_rows':len(rows),  # compatibility; includes unknown/suppressed cells
            'area_count_observed':len(observed_areas),
            'area_count_expected':51 if kind == 'state' else None,
            'reference_status_counts':dict(counts),
            'coverage_not_commercial_approval':True,
        }
    for kind, rows in validated_rows.items():
        save_csv(out/f'{kind}_trade_coverage.csv',rows)
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    return manifest

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--state',required=True,help='BLS OEWS May 2025 state ZIP/XLSX or test CSV')
    ap.add_argument('--metro',required=True,help='BLS OEWS May 2025 metro ZIP/XLSX or test CSV')
    ap.add_argument('--out',required=True)
    args=ap.parse_args()
    print(json.dumps(run(args.state,args.metro,args.out),indent=2))

if __name__=='__main__': main()