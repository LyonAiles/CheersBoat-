#!/usr/bin/env python3
"""Pack the published EuRIS/Rijkswaterstaat GeoJSON network for Nautic."""
import argparse
import json
import math
from pathlib import Path

SOURCE = "https://doi.org/10.5281/zenodo.20793663"


def coord(pair):
    return tuple(round(value * 1_000_000) for value in pair[:2])


def distance(point, other):
    return math.hypot((point[0] - other[0]) * .65, point[1] - other[1])


def simplify(points, tolerance=36):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    x, y = (b[0] - a[0]) * .65, b[1] - a[1]
    denominator = x*x + y*y or 1

    def error(point):
        u, v = (point[0] - a[0]) * .65, point[1] - a[1]
        t = max(0, min(1, (u*x + v*y) / denominator))
        return math.hypot(u - t*x, v - t*y)

    middle = max(range(1, len(points)-1), key=lambda index: error(points[index]))
    if error(points[middle]) <= tolerance:
        return [a, b]
    return simplify(points[:middle+1], tolerance)[:-1] + simplify(points[middle:], tolerance)


def encode(points):
    def delta(value):
        encoded = -2 * value - 1 if value < 0 else 2 * value
        while encoded >= 32:
            yield chr((encoded & 31) + 95)
            encoded >>= 5
        yield chr(encoded + 63)

    x = y = 0
    encoded = []
    for next_x, next_y in points:
        encoded.extend(delta(next_y - y))
        encoded.extend(delta(next_x - x))
        x, y = next_x, next_y
    return ''.join(encoded)


def features(path):
    return json.loads(path.read_text())['features']


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('edges', type=Path)
    cli.add_argument('nodes', type=Path)
    cli.add_argument('output', type=Path)
    args = cli.parse_args()
    rows = []
    nodes = {f['properties']['node_id']: coord(f['geometry']['coordinates']) for f in features(args.nodes)}
    for feature in features(args.edges):
        info = feature['properties']
        if info['data_source'] != 'EURIS':
            continue
        country = info['cntrycode']
        origin = info['source'].removeprefix('EURIS_')
        destination = info['target'].removeprefix('EURIS_')
        geometry = [coord(p) for p in feature['geometry']['coordinates']]
        if country not in ('FR', 'BE', 'LU'):
            # Rhine and Moselle shores and directly adjacent connections.
            if country is not None and not (country == 'DE' and any(
                    6_000_000 <= x <= 8_550_000 and 47_400_000 <= y <= 50_300_000
                    for x, y in geometry)):
                continue
            if country is None and not any(node[:2] in ('FR', 'BE', 'LU') for node in (origin, destination)):
                continue
        if origin not in nodes or destination not in nodes or len(geometry) < 2:
            continue
        start, end = nodes[origin], nodes[destination]
        if distance(geometry[-1], start) + distance(geometry[0], end) < distance(geometry[0], start) + distance(geometry[-1], end):
            geometry.reverse()
        # Use the common junction coordinates except where the official edge is
        # off its node, in which case preserve the published geometry.
        if distance(geometry[0], start) < 135:
            geometry[0] = start
        if distance(geometry[-1], end) < 135:
            geometry[-1] = end
        code = info.get('code') or origin + '/' + destination
        label = info.get('rt_name') or info.get('ww_name') or info.get('name') or ''
        scope = country + info['fw_code'] if country and info.get('fw_code') else ''
        rows.append([code, origin, destination, label, info.get('active') == 0, scope, encode(simplify(geometry))])
    args.output.write_text(
        '// Baart & Turpijn, FIS-EURIS Inland Waterway Network Dataset v3, CC BY 4.0. ' + SOURCE +
        '\n// Data provided by EuRIS (www.eurisportal.eu) and Rijkswaterstaat. Subset and simplified geometry.\n' +
        'globalThis.NauticEurisRows=[\n' +
        ',\n'.join(json.dumps(row, ensure_ascii=False, separators=(',', ':')) for row in rows) +
        '\n];\n', encoding='utf-8')
    print(f'{len(rows)} sections • {args.output.stat().st_size} bytes')


if __name__ == '__main__':
    main()
