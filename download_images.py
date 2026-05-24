#!/usr/bin/env python3
"""Lädt Car-Bilder von Wikipedia (freie Lizenz) herunter."""

import urllib.request
import urllib.parse
import json
import os
import time
import sys

IMAGES_DIR = os.path.join(os.path.dirname(__file__), "images")
WIKI_API   = "https://en.wikipedia.org/w/api.php"
HEADERS    = {"User-Agent": "AutoQuartett/1.0 (privates Projekt)"}
THUMB_SIZE = 800

WIKI_TITLES = {
    "ferrari_f40":              "Ferrari F40",
    "mclaren_f1":               "McLaren F1",
    "bugatti_eb110_ss":         "Bugatti EB110",
    "lamborghini_diablo_sv":    "Lamborghini Diablo",
    "ferrari_enzo":             "Ferrari Enzo",
    "porsche_carrera_gt":       "Porsche Carrera GT",
    "porsche_911_turbo_s":      "Porsche 911 (992)",
    "lamborghini_huracan_sto":  "Lamborghini Huracán STO",
    "mclaren_720s":             "McLaren 720S",
    "audi_r8_v10_performance":  "Audi R8",
    "amg_gt_black_series":      "Mercedes-AMG GT (C190)",
    "maserati_mc20":            "Maserati MC20",
    "ferrari_296_gtb":          "Ferrari 296 GTB",
    "ferrari_laferrari":        "Ferrari LaFerrari",
    "mclaren_p1":               "McLaren P1",
    "porsche_918_spyder":       "Porsche 918 Spyder",
    "ferrari_sf90_stradale":    "Ferrari SF90 Stradale",
    "lamborghini_revuelto":     "Lamborghini Revuelto",
    "mclaren_speedtail":        "McLaren Speedtail",
    "bugatti_chiron_ss_300":    "Bugatti Chiron Super Sport 300+",
    "koenigsegg_jesko_absolut": "Koenigsegg Jesko",
    "pagani_huayra_r":          "Pagani Huayra",
    "lamborghini_aventador_svj":"Lamborghini Aventador",
    "gordon_murray_t50":        "Gordon Murray T.50",
    "rimac_nevera":             "Rimac Nevera",
    "lotus_evija":              "Lotus Evija",
    "porsche_taycan_turbo_gt":  "Porsche Taycan",
    "tesla_model_s_plaid":      "Tesla Model S",
    "pininfarina_battista":     "Pininfarina Battista",
    "aspark_owl":               "Aspark Owl",
    "bmw_m5_cs":                "BMW M5 (F90)",
    "bmw_m4_csl":               "BMW M4",
    "mercedes_amg_one":         "Mercedes-AMG One",
}

def api_request(params, retries=4):
    url = WIKI_API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 8 * (attempt + 1)
                print(f"    ⏳ Rate-Limit, warte {wait}s …", end="\r")
                time.sleep(wait)
            else:
                raise
        except Exception:
            time.sleep(3)
    raise RuntimeError("Zu viele Fehler")

def get_thumb_url(title):
    data = api_request({
        "action":      "query",
        "titles":      title,
        "prop":        "pageimages",
        "format":      "json",
        "pithumbsize": THUMB_SIZE,
        "pilicense":   "free",
    })
    for page in data.get("query", {}).get("pages", {}).values():
        thumb = page.get("thumbnail", {})
        if thumb:
            return thumb.get("source")
    return None

def download(car_id, title):
    out = os.path.join(IMAGES_DIR, f"{car_id}.jpg")
    if os.path.exists(out) and os.path.getsize(out) > 5000:
        print(f"  ✓ {car_id} – bereits vorhanden")
        return True

    url = get_thumb_url(title)
    if not url:
        print(f"  ✗ {car_id} – kein Bild auf Wikipedia für «{title}»")
        return False

    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20) as r:
                data = r.read()
            with open(out, "wb") as f:
                f.write(data)
            kb = len(data) // 1024
            print(f"  ✓ {car_id} – {kb} KB")
            return True
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 10 * (attempt + 1)
                print(f"    ⏳ Rate-Limit, warte {wait}s …", end="\r")
                time.sleep(wait)
            else:
                print(f"  ✗ {car_id} – HTTP {e.code}")
                return False
        except Exception as e:
            print(f"  ✗ {car_id} – Fehler: {e}")
            return False
    return False

if __name__ == "__main__":
    os.makedirs(IMAGES_DIR, exist_ok=True)
    total   = len(WIKI_TITLES)
    success = 0
    print(f"Lade {total} Bilder von Wikipedia (freie Lizenz)...\n")

    for car_id, title in WIKI_TITLES.items():
        if download(car_id, title):
            success += 1
        time.sleep(1.5)   # höfliche Pause, verhindert Rate-Limit

    print(f"\n{'─'*40}")
    print(f"Ergebnis: {success}/{total} Bilder erfolgreich")
    if success < total:
        print("Fehlende Bilder → Platzhalter wird in der App angezeigt.")
    print("Fertig.")
