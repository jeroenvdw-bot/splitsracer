#!/usr/bin/env python3
"""Download the Kenney Racing Pack (CC0) and copy the sprites used by Splitsracer.

Usage:
    python3 tools/fetch_assets.py                 # download + extract
    python3 tools/fetch_assets.py --zip bestand.zip
    python3 tools/fetch_assets.py --force          # assets opnieuw kopiëren

Alleen Python 3-stdlib en curl-vrije urllib zijn nodig; er is geen unzip,
Node, ImageMagick of PIL vereist.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")

PAGE_URL = "https://kenney.nl/assets/racing-pack"
DOWNLOAD_LINK = "https://kenney.nl/download-link/6173736574732f726163696e672d7061636b"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)

# Bron in de Kenney-zip -> bestandsnaam in assets/
WANTED = {
    "PNG/Cars/car_blue_1.png": "car_player.png",
    "PNG/Cars/car_red_1.png": "car_opponent.png",
    "PNG/Objects/tree_large.png": "tree_large.png",
    "PNG/Objects/tree_small.png": "tree_small.png",
    "PNG/Objects/rock1.png": "rock1.png",
    "PNG/Objects/rock2.png": "rock2.png",
    "PNG/Objects/rock3.png": "rock3.png",
}

README = """# Assets

De sprites in deze map komen uit de **Kenney Racing Pack**:
<https://kenney.nl/assets/racing-pack>

- Licentie: **CC0 1.0** (publiek domein)
- Auteur: Kenney (<https://kenney.nl>)
- De volledige licentie staat in `Kenney-Racing-Pack-License.txt`.

| Bestand | Bron in de pack |
|---|---|
| `car_player.png` | `PNG/Cars/car_blue_1.png` |
| `car_opponent.png` | `PNG/Cars/car_red_1.png` |
| `tree_large.png` | `PNG/Objects/tree_large.png` |
| `tree_small.png` | `PNG/Objects/tree_small.png` |
| `rock1.png` | `PNG/Objects/rock1.png` |
| `rock2.png` | `PNG/Objects/rock2.png` |
| `rock3.png` | `PNG/Objects/rock3.png` |

De baan, curbs, borden en getalskaarten worden procedureel in canvas getekend
in dezelfde stijl (grijs-blauw asfalt, oranje/witte curbs).
"""


def request_json(url: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": PAGE_URL,
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def download_pack(destination: str) -> None:
    print("· signed download-URL ophalen …")
    data = request_json(DOWNLOAD_LINK)
    url = data.get("url")
    if not url:
        raise RuntimeError("Geen download-URL ontvangen van kenney.nl")
    print("· pack downloaden …")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as response, open(destination, "wb") as out:
        shutil.copyfileobj(response, out)
    print(f"· gedownload naar {destination} ({os.path.getsize(destination)} bytes)")


def copy_assets(zip_path: str, force: bool) -> None:
    os.makedirs(ASSETS, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        names = set(archive.namelist())
        missing = [source for source in WANTED if source not in names]
        if missing:
            raise RuntimeError("Onverwachte packinhoud; ontbrekend: " + ", ".join(missing))

        for source, target in WANTED.items():
            target_path = os.path.join(ASSETS, target)
            if os.path.exists(target_path) and not force:
                print(f"  = {target} bestaat al")
                continue
            with archive.open(source) as src, open(target_path, "wb") as dst:
                shutil.copyfileobj(src, dst)
            print(f"  + {target}")

        license_source = "License.txt"
        if license_source in names:
            license_target = os.path.join(ASSETS, "Kenney-Racing-Pack-License.txt")
            if force or not os.path.exists(license_target):
                with archive.open(license_source) as src, open(license_target, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                print("  + Kenney-Racing-Pack-License.txt")

    with open(os.path.join(ASSETS, "README.md"), "w", encoding="utf-8") as handle:
        handle.write(README)
    print(f"· klaar; assets staan in {ASSETS}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", help="gebruik een al gedownload Kenney-zipbestand")
    parser.add_argument("--force", action="store_true", help="bestaande assets overschrijven")
    args = parser.parse_args()

    zip_path = args.zip
    temp_path = None
    try:
        if not zip_path:
            fd, temp_path = tempfile.mkstemp(prefix="kenney-racing-", suffix=".zip")
            os.close(fd)
            zip_path = temp_path
            download_pack(zip_path)
        copy_assets(zip_path, args.force)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
