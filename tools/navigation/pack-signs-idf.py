"""Pack Geofabrik's Île-de-France polygon and OSM navigation sign nodes.

Usage: python pack-signs-idf.py extract.osm.pbf extract.poly YYYY-MM-DD output.js
Requires pyosmium. The generated data is distributed under ODbL 1.0.
"""
import argparse
import json
from pathlib import Path

import osmium


def read_rings(path):
    rings = []
    ring = None
    for line in path.read_text().splitlines()[1:]:
        if line.strip() == "END":
            ring = None
        elif line[:1].isspace():
            ring.append([float(value) for value in line.split()])
        else:
            ring = []
            rings.append(ring)
    return rings


def extract_signs(path):
    categories = ["seamark:notice:category"]
    categories += [f"seamark:notice:{index}:category" for index in range(1, 17)]
    matches = osmium.filter.KeyFilter("seamark:type", *categories)
    for obj in osmium.FileProcessor(path).with_filter(matches):
        tags = obj.tags
        if tags.get("seamark:type") != "notice" and not any(tags.get(key) for key in categories):
            continue
        if obj.type_str() != "n" or not obj.location.valid():
            raise ValueError(f"Vérifier la géométrie du panneau {obj.type_str()}{obj.id}")
        yield {
            "id": obj.id, "type": "node", "lat": obj.lat, "lon": obj.lon,
            "tags": {tag.k: tag.v for tag in tags if tag.k.startswith("seamark:notice:") or tag.k in ("name", "seamark:type")},
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("extract", type=Path)
    parser.add_argument("polygon", type=Path)
    parser.add_argument("date")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    elements = list(extract_signs(args.extract))
    data = {"date": args.date, "rings": read_rings(args.polygon), "elements": elements}
    args.output.write_text(
        "/* © contributeurs OpenStreetMap, ODbL 1.0 · https://www.openstreetmap.org/copyright\n"
        "   Extrait Île-de-France · https://download.geofabrik.de/europe/france/ile-de-france.html */\n"
        "window.NauticSignsIdf=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    )
    print(f"{len(elements)} panneaux")


if __name__ == "__main__":
    main()
