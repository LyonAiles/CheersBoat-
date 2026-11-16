#!/usr/bin/env python3
"""Build France fairway limits from EuRIS graph, Bridges and VNF RIS Index exports."""
import argparse
import collections
import io
import json
from pathlib import Path
import zipfile

from openpyxl import load_workbook


def scope(value):
    return value[-3:] if value[:2].isalpha() and value[-3:].isdigit() else value


def positive(*values):
    return min((value for value in values if isinstance(value, (int, float)) and value > 0), default=0)


def line_gap(point, line):
    lon, lat = point
    best = float('inf')
    for (a, b), (c, d) in zip(line, line[1:]):
        x, y = (c-a)*.66, d-b
        u, v = (lon-a)*.66, lat-b
        t = max(0, min(1, (u*x+v*y)/(x*x+y*y or 1)))
        best = min(best, (u-t*x)**2+(v-t*y)**2)
    return best


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    for name in ('edges', 'bridges', 'ris_zip', 'output'):
        cli.add_argument(name, type=Path)
    args = cli.parse_args()
    sections = collections.defaultdict(list)
    limits = {}
    constraints = collections.defaultdict(dict)
    for f in json.loads(args.edges.read_text())['features']:
        p = f['properties']
        if p.get('cntrycode') != 'FR' or not p.get('fw_code') or not p.get('code'):
            continue
        section = p['code']
        geometry = [pair[:2] for pair in f['geometry']['coordinates']]
        sections[scope(p['fw_code'])].append((section, geometry))
        limits[section] = [positive(p['mdraughtcm']), None, positive(p['mwidthcm'])]
    bridges = {}
    for row in json.loads(args.bridges.read_text()):
        info = row.get('feature') or {}
        if (info.get('locode') or '').startswith('FR'):
            bridges[info['locode']] = info
    with zipfile.ZipFile(args.ris_zip) as source:
        sheet = load_workbook(io.BytesIO(source.read(source.namelist()[0])), read_only=True, data_only=True).active
        rows = sheet.values
        keys = next(rows)
        positions = {key: keys.index(key) for key in ('FW_CODE', 'CountryCodeUNLOCODEFW_CODEOBJECT_CODEHECTOM', 'Functie', 'Lat', 'long_')}
        indexed = set()
        missing = set()
        for row in rows:
            get = lambda key: row[positions[key]]
            if get('Functie') != 'brgare' or not get('FW_CODE'):
                continue
            key = scope(str(get('FW_CODE')))
            if key not in sections:
                continue
            indexed.add(key)
            try:
                point = (float(get('long_')), float(get('Lat')))
            except (TypeError, ValueError):
                missing.add(key)
                continue
            distances = [(line_gap(point, line), code) for code, line in sections[key]]
            nearest = min(gap for gap, _ in distances)
            if nearest > .0012**2:
                missing.add(key)
                continue
            b = bridges.get(get('CountryCodeUNLOCODEFW_CODEOBJECT_CODEHECTOM'), {})
            height = positive(b.get('mheightcm'), b.get('mheightcmc'))
            width = positive(b.get('mwidthcm'), b.get('mwidcon'))
            for gap, code in distances:
                if gap > nearest + .000025**2:
                    continue
                previous = limits[code][1]
                limits[code][1] = height if previous is None else min(height, previous)
                name = b.get('objectname')
                if height and (previous is None or height < previous) and name:
                    constraints[code]['air'] = [name, b['locode']]
                if width and width < limits[code][2]:
                    limits[code][2] = width
                    if name:
                        constraints[code]['width'] = [name, b['locode']]
    for key, values in sections.items():
        for code, _ in values:
            if limits[code][1] is None:
                limits[code][1] = -1 if key in indexed and key not in missing else 0
            elif key in missing:
                limits[code][1] = 0
    # EuRIS groups the open Thau crossing (Sète–Les Onglous) under Canal du Midi.
    # Its 140 cm value is the Midi's reference value; the crossing needs its own.
    if 'FRVN11400017' in limits:
        limits['FRVN11400017'][0] = 0
    provenance = {code: {key: origin for key, origin in fields.items()
                         if key != 'air' or limits[code][1] > 0}
                  for code, fields in constraints.items()}
    # EuRIS groups the open Thau crossing (Sète–Les Onglous) under Canal du Midi.
    # Its 140 cm value is the Midi's reference value; the crossing needs its own.
    if 'FRVN11400017' in limits:
        limits['FRVN11400017'][0] = 0
    provenance = {code: fields for code, fields in provenance.items() if fields}
    args.output.write_text(
        '// EuRIS Bridges / VNF RIS Index (2026-04-29), FIS-EURIS graph (CC BY 4.0).\n'
        '// Dimensions in cm. Air: -1 = no bridge in indexed section; 0 = unverified.\n'
        'globalThis.NauticClearances=' + json.dumps(limits, separators=(',', ':')) + ';\n' +
        'globalThis.NauticClearanceSources=' + json.dumps(provenance, ensure_ascii=False, separators=(',', ':')) + ';\n'
    )
    counts = collections.Counter('unknown' if row[1] == 0 else 'no indexed bridge' if row[1] == -1 else 'height' for row in limits.values())
    print(len(limits), dict(counts))


if __name__ == '__main__':
    main()
