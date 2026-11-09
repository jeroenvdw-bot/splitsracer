# Plan — Splitsracer

Educatief racespel voor een zesjarige (eerste leerjaar): splitsingen oefenen als **splitsingen in de weg** op een rechte racebaan, van bovenaf. Nederlands talig, speelbaar als PWA in de browser en installeerbaar op een tablet.

## Spelidee

- Een **rechte racebaan die verticaal scrollt**: de auto rijdt "omhoog" het scherm in (klassieke top-down racer), de camera volgt op de y-as. De auto van de speler rijdt **vanzelf** (voorlopig geen stuurcontrole).
- De tegenstander rijdt in een parallelle strook en is **iets sneller** dan de speler → zonder boosts verliest de speler.
- Op vaste afstanden **splitst de weg zich in twee aftakkingen: links en rechts** (de splitsing). Bovenaan staat een bord met **het totaal** (bv. 7) en **het gegeven getal** (bv. 4). Daaronder staan op elke aftakking grote getallen (kandidaat-antwoorden, waarvan precies één juist is: totaal − gegeven). Later maakt dit het sturen naar links/rechts intuïtief (en oefent meteen de begrippen links/rechts).
- De auto **stopt automatisch bij de splitsing** (er is geen navigatie nodig om de splitsing te activeren). Het kind **tipt het getal op één van de aftakkingen**:
  - **Juiste keuze** → de auto neemt de juiste weg en krijgt een **boost** (tijdelijke versnelling + vlammen/snelheidslijnen).
  - **Foute keuze** → de auto neemt de **foute weg, zonder boost** — een tragere/langere omweg die daarna weer op de hoofdbaan uitkomt.
- Tijdens het kiezen **pauzeren beide auto's**; de speler verliest dus geen tijd met nadenken. De straf bij fout is het verloren boost-moment plus de omweg.
- Na de ingestelde lengte is er een finish; wie eerst over de finish rijdt, wint. Winst = feestmoment (confetti).
- **Toekomstige uitbreiding (nu nog niet):** het kind zelf laten sturen — bij een splitsing links of rechts kiezen via een veeg/tik; de splitsingen activeren nu dus volledig automatisch.

## Beslissingen (met de gebruiker afgesproken)

| Onderwerp | Keuze |
|---|---|
| Technologie | Vanilla HTML/CSS/JS + Canvas 2D, geen build-stap |
| Ontwikkelomgeving | Linux; tooling met Python 3-stdlib + curl (geen Node, PIL, ImageMagick of `unzip` nodig) |
| Baan | Rechte baan die **verticaal scrollt** (auto rijdt omhoog), finish op vaste (instelbare) afstand — geen rondes |
| Oefenvorm | Splitsing in de weg (aftakkingen met getalskaarten), géén splitshuisje-overlay |
| Activeren | Automatisch bij het bereiken van de splitsing; nog geen navigatie/sturen |
| Juiste keuze | Juiste weg nemen **met boost** |
| Foute keuze | Foute (tragere omweg) weg nemen, **zonder boost** |
| Tijdens kiezen | Beide auto's pauzeren |
| Max getal (instelling) | Keuzes 5 t/m 10 |
| Geluid | Ja, gesynthetiseerd via Web Audio (motor, boost, juist/fout, finish) met mute-knop |
| Tal van de UI | Nederlands |

## Techniek

**Omgeving (Linux, geverifieerd):** Linux, werkmap `/home/jeroen/splitsracer`. Beschikbaar: Python 3.14 (alleen stdlib; géén PIL/pip), `curl`, `apt-get` (maar geen passwordless sudo). Niet beschikbaar: Node/npm, ImageMagick, `unzip`, Git en een browser. Daarom: assets ophalen met `curl` + uitpakken met Python `zipfile`, iconen genereren met een Python-stdlibscript, lokaal serveren met `python3 -m http.server`, en visueel/PWA testen handmatig in een browser op de host/tablet (in deze omgeving alleen statische checks).

- **PWA:** `manifest.webmanifest` (naam, iconen 192/512 + maskable, standalone, vrije schermoriëntatie) + service worker `sw.js` met cache-first strategie en versiede cache → offline speelbaar.
- **Iconen:** procedureel gegenereerd met `tools/make_icons.py` (Python 3-stdlib; PNG via `zlib`, dus geen PowerShell/.NET, Pillow of ImageMagick nodig): groen gras, Y-splitsing, oranje/witte curbs en een blauwe auto. 192, 512 en 512-maskable (veilige zone) + 180 apple-touch-icon.
- **Assets:** Kenney Racing Pack (https://kenney.nl/assets/racing-pack, CC0) lokaal in `assets/`. Downloadflow op Linux (geverifieerd):
  1. `curl -A "Mozilla/5.0 …" https://kenney.nl/assets/racing-pack` — zonder browser-User-Agent geeft de site 403.
  2. Signed URL ophalen via `curl -A "Mozilla/5.0 …" -e https://kenney.nl/assets/racing-pack https://kenney.nl/download-link/6173736574732f726163696e672d7061636b` → JSON met tijdelijke download-URL.
  3. Zip downloaden en uitpakken met `python3 -m zipfile -e` (geen `unzip` nodig).
  Gebruik: `PNG/Cars/car_blue_1.png` (speler) en `PNG/Cars/car_red_1.png` (tegenstander), beide 71×131 en staan al omhoog; `PNG/Objects/tree_large.png`, `tree_small.png` en `rock1..3.png` als scenery. De grass-tile uit de pack is een overgangstile met een bruine rand en is daarom niet als herhalende achtergrond gebruikt; het gras wordt procedureel getekend met polletjes. **De pack bevat geen finishvlag** → finish als checkered lijn + FINISH-bord in canvas. De Y-splitsing is geen kant-en-klare tegel; de baan, aftakkingen, eilandjes en curbs worden procedureel in canvas getekend in dezelfde stijl (grijs-blauw asfalt, oranje/witte curbs). Getalskaarten en borden worden in canvas getekend (groot, goed leesbaar lettertype). Neem `License.txt`/CC0-vermelding op in `assets/README.md`. Geen CDN-afhankelijkheden.
- **Rendering:** Canvas 2D met camera die de speler volgt op de y-as; devicePixelRatio-scaling; grote tikbare zones (minstens ±64 px) voor tabletgebruik; verticale voortgangsbalk (speler vs. tegenstander) aan de zijkant als HUD.
- **Splitsgenerator:** totaal willekeurig uit 2..max-instelling; gegeven deel willekeurig 1..totaal−1; juiste keuze = totaal − gegeven; foute kandidaten zijn nabije getallen (bijv. juiste ± 1, begrensd op 0..totaal), nooit gelijk aan het juiste antwoord.
- **Instellingen** in localStorage: max getal (5–10), racelengte (kort/middel/lang, mappen op het aantal splitsingen), geluid aan/uit.
- **Audio:** lichte gesynthetiseerde geluidjes via Web Audio API; mute-knop in het spel.

## Schermen / flow

1. Titel (Splitsracer — Speel / Instellingen)
2. Instellingen (max getal 5–10, racelengte, geluid)
3. Countdown 3-2-1 → race
4. Race: auto's rijden; bij elke splitsing stopt de speler en kiest het kind door op een getalskaart (links of rechts) te tikken; juist = boost, fout = omweg zonder boost
5. Finish: uitslag, confetti bij winst, "Nog eens spelen"

## Structuur

```
index.html
manifest.webmanifest
sw.js
css/style.css
js/main.js        start, gameloop, schermen
js/game.js        race, auto's, camera, boosts, finish
js/road.js        rechte baan (verticaal scrollend), stroken, aftakkingen links/rechts
js/splits.js      splitsgenerator + keuzelogica (juist/fout)
js/settings.js    instellingen + localStorage
js/audio.js       Web Audio geluidjes + mute
assets/           Kenney-sprites + README.md (bron/licentie)
icons/            192/512/maskable
tools/            fetch_assets.py, make_icons.py (Linux, Python-stdlib)
plan.md
```

Lokaal testen via een statische server (nodig voor de service worker):

```
python3 -m http.server 8080
```

Daarna te openen op http://localhost:8080 en te hosten op elke statische host (bv. GitHub Pages).

## Volgorde van werk

1. Assets ophalen met `tools/fetch_assets.py` (curl-flow + `zipfile`) en alleen de benodigde sprites uit de Kenney-pack naar `assets/` kopiëren
2. Projectstructuur, index.html, manifest, service worker
3. Rechte baan (verticaal scrollend) + auto's + camera
4. Splitsingen in de weg: aftakkingen, bord, getalskaarten, keuze, juiste/foute weg
5. Boost-mechaniek en finish
6. Instellingen, schermen
7. Audio + mute-knop
8. Iconen genereren met `tools/make_icons.py` (Python-stdlib)
9. Testen: `python3 -m http.server` + statische checks (HTTP 200, manifest-JSON, cachelijst); daarna handmatige browser- en PWA-installatiecheck op host/tablet (in deze Linux-omgeving is geen browser beschikbaar)

