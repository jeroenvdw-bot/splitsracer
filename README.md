# Splitsracer

Educatief racespel voor een zesjarige: oefen **splitsingen, optellen en aftrekken** als opgaven op de racebaan.
De auto rijdt vanzelf omhoog over een verticale racebaan. Bij elke opgave stopt de
speler; tik het juiste getal aan op de linker- of rechteraftakking.

- **Juist** → de auto neemt die weg en krijgt een boost.
- **Fout** → de auto neemt de tragere omweg, zonder boost. De juiste splitsing wordt getoond.
- De tegenstander rijdt intussen mee en kan bij een opgave pauzeren (instelbaar). Wie het eerst over de finish is, wint.

## Spelen

Online: <https://jeroenvdw-bot.github.io/splitsracer/>

Lokaal:

```bash
python3 tools/serve.py --bind 127.0.0.1 --port 8080
```

Open daarna <http://localhost:8080>. De service worker werkt alleen via
`http://localhost` of https, niet via `file://`.

Vanaf een tablet of een ander toestel op hetzelfde netwerk:

```bash
python3 tools/serve.py --bind 0.0.0.0 --port 8080
```

Open dan `http://<LAN-IP-van-de-VM>:8080`. De server blokkeert verborgen
bestanden (waaronder `.git`) en mapoverzichten. Via een LAN-IP op gewone http
werkt het spel wel, maar de service worker en PWA-installatie niet; daarvoor is
https of localhost nodig.

Als PWA installeren: open de app in Chrome/Edge op de tablet en kies
**Installeren** of **Toevoegen aan startscherm**. De app werkt daarna offline en
volgt de stand van het scherm (liggend of staand).

## Besturing

- **Tik** op een getalskaart (of ergens op de linker-/rechteraftakking) om te kiezen.
- Toetsenbord: **←/→** of **A/D** om te kiezen, **M** voor mute.
- **Enter/Space** start een race vanaf het titel- of resultaatscherm.

## Instellingen

- **Grootste getal:** 5 t/m 10 (geldt voor alle soorten opgaven).
- **Soort opgave:** Splitsen, Optellen of Aftrekken.
- **Racelengte:** Kort (4 opgaven), Middel (6), Lang (8).
- **Tegenstander wacht:** aan/uit; of de tegenstander bij een opgave pauzeert. Standaard aan.
- **Geluid:** aan/uit; de keuze wordt in `localStorage` bewaard.

## Techniek

Vanilla HTML/CSS/JS + Canvas 2D, zonder buildstap. De baan, curbs, borden,
getalskaarten en finish worden procedureel getekend. De auto's, bomen en rotsen
komen uit de Kenney Racing Pack (CC0); zie `assets/README.md`.

```
index.html
manifest.webmanifest
sw.js
css/style.css
js/settings.js    instellingen + localStorage
js/splits.js      oefengenerator (splitsen, optellen, aftrekken)
js/road.js        baan, camera-hulpjes, splitsingen, borden, kaarten
js/audio.js       Web Audio (motor, boost, juist/fout, finish)
js/game.js        race, auto's, boost, finish, confetti
js/main.js        schermen, UI, game-loop, PWA-registratie
assets/           Kenney-sprites + licentie
icons/            192/512/maskable/apple-touch
tools/            fetch_assets.py, make_icons.py, serve.py
```

## Assets en iconen opnieuw genereren

```bash
python3 tools/fetch_assets.py        # downloadt de Kenney Racing Pack
python3 tools/make_icons.py          # genereert icons/*.png
```

Beide scripts gebruiken alleen de Python 3-stdlib (geen PIL, ImageMagick of unzip).
