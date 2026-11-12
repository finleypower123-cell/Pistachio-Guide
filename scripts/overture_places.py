"""
Downloads Overture Maps places (https://overturemaps.org) around each city, for the weekly city build.

Overture's places are open data (CDLA Permissive 2.0 and Apache 2.0, no OpenStreetMap data). They are
published as large files rather than an API, so they are read here, once a week, on GitHub's runners,
and only the kinds of place Pistachio Guide lists are kept. scripts/build-city-data.ts then merges
them with the OpenStreetMap places.

Usage: python3 scripts/overture_places.py cities.json out_dir
  cities.json: [{"slug": "brussels", "lat": 50.85, "lng": 4.35, "radiusKm": 5}, ...]
Needs: pip install overturemaps pyarrow
"""
import json
import math
import os
import sys

from overturemaps import core

# Overture taxonomy categories that match a section of the app. src/lib/overture.ts maps each one
# to a category; anything else is dropped here to keep the files small.
KEEP = {
    "cafe", "coffee_shop", "tea_room", "coffee_roastery", "cat_cafe", "board_game_cafe",
    "art_gallery", "museum", "art_museum", "history_museum", "science_museum", "contemporary_art_museum",
    "modern_art_museum", "textile_museum", "community_museum", "childrens_museum", "aviation_museum",
    "natural_history_museum", "military_museum", "design_museum", "photography_museum", "planetarium",
    "movie_theater", "theatre_venue", "performing_arts_venue", "music_venue", "comedy_club",
    "escape_room", "bowling_alley", "arcade", "rock_climbing_gym", "climbing_gym", "bouldering_gym",
    "miniature_golf_course", "swimming_pool", "amusement_park", "water_park", "zoo", "petting_zoo",
    "aquarium", "ice_skating_rink", "karaoke_venue", "indoor_playcenter", "trampoline_park",
    "second_hand_store", "second_hand_clothing_store", "thrift_store", "vintage_store", "antique_store",
    "flea_market", "farmers_market", "night_market", "brewery", "botanical_garden", "castle", "boat_rental",
}
CLOSED = {"permanently_closed", "temporarily_closed"}


def first(xs):
    return xs[0] if xs else None


def distance_km(lat1, lng1, lat2, lng2):
    r = math.pi / 180
    a = math.sin((lat2 - lat1) * r / 2) ** 2 + math.cos(lat1 * r) * math.cos(lat2 * r) * math.sin((lng2 - lng1) * r / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


def slim(row):
    tax = row.get("taxonomy") or {}
    primary = tax.get("primary")
    if primary not in KEEP or row.get("operating_status") in CLOSED:
        return None
    name = ((row.get("names") or {}).get("primary") or "").strip()
    if not name:
        return None
    box = row.get("bbox") or {}
    addr = first(row.get("addresses")) or {}
    brand = (((row.get("brand") or {}).get("names") or {}).get("primary")) or None
    brand_wikidata = (row.get("brand") or {}).get("wikidata") or None
    datasets = sorted({s.get("dataset") for s in (row.get("sources") or []) if s.get("dataset") and s.get("dataset") != "Overture"})
    return {
        "id": row["id"],
        "name": name,
        "lat": round((box["ymin"] + box["ymax"]) / 2, 6),
        "lng": round((box["xmin"] + box["xmax"]) / 2, 6),
        "primary": primary,
        "hierarchy": tax.get("hierarchy") or [],
        "confidence": round(row.get("confidence") or 0, 3),
        "status": row.get("operating_status"),
        "websites": row.get("websites") or [],
        "socials": row.get("socials") or [],
        "phones": row.get("phones") or [],
        "brand": brand,
        "brandWikidata": brand_wikidata,
        "street": addr.get("freeform") or None,
        "locality": addr.get("locality") or None,
        "postcode": addr.get("postcode") or None,
        "country": addr.get("country") or None,
        "datasets": datasets,
    }


def main():
    cities = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    release = core.get_latest_release()
    print("Overture release", release)
    for c in cities:
        lat, lng, km = c["lat"], c["lng"], c["radiusKm"]
        dlat = km / 111.0
        dlng = km / (111.0 * math.cos(math.radians(lat)))
        try:
            reader = core.record_batch_reader("place", (lng - dlng, lat - dlat, lng + dlng, lat + dlat), release=release)
            places = []
            for batch in reader:
                for row in batch.to_pylist():
                    p = slim(row)
                    if p and distance_km(lat, lng, p["lat"], p["lng"]) <= km:
                        places.append(p)
            json.dump({"release": release, "places": places}, open(os.path.join(out, c["slug"] + ".json"), "w"))
            print(f"{c['slug']}: {len(places)} Overture places kept")
        except Exception as e:  # one city failing shouldn't stop the rest
            print(f"{c['slug']}: Overture download failed ({str(e)[:120]})")


if __name__ == "__main__":
    main()
