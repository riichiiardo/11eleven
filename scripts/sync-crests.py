#!/usr/bin/env python3
"""
11Eleven — escudos de los clubes del catálogo (FC 27).

Fuente: API pública de ESPN (site.api.espn.com + CDN a.espncdn.com), sin clave
ni coste de consumo. Descarga el escudo de cada club del snapshot y lo guarda
en `public/crests/<slug>.png`; `src/lib/crests.ts` mapea nombre de club → ruta.

Uso:
    python3 scripts/sync-crests.py fetch      # descarga los escudos que falten
    python3 scripts/sync-crests.py optimize   # reduce todo a 256px (valida el resultado)

La coincidencia nombre-snapshot ↔ club de ESPN se hace por clave normalizada y,
cuando el nombre del catálogo difiere del del club (p. ej. "Wolverhampton" →
"Wolverhampton Wanderers"), por la tabla OVERRIDE.
"""

import difflib
import json
import os
import re
import struct
import sys
import time
import unicodedata
import urllib.request
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDER = os.path.join(ROOT, "public", "crests")
SNAPSHOT = os.path.join(ROOT, "src", "convex", "footballData.ts")
TARGET = 256

# ESPN competition slugs that cover the snapshot leagues (incl. second and third
# divisions, because the snapshot keeps clubs that were just relegated).
LEAGUES = [
    "eng.1", "eng.2", "eng.3",
    "esp.1", "esp.2",
    "ita.1", "ita.2",
    "ger.1", "ger.2",
    "fra.1", "ned.1", "por.1",
    "bra.1", "arg.1", "mex.1", "col.1",
    "ksa.1", "tur.1", "usa.1", "jpn.1",
]

OVERRIDE = {
    "Wolverhampton": "Wolverhampton Wanderers",
    "Southampton FC": "Southampton",
    "RC Celta": "Celta Vigo",
    "RCD Mallorca": "Mallorca",
    "UD Almería": "Almería",
    "Olympique de Marsella": "Marseille",
    "Olympique Lyonnais": "Lyon",
    "Inter de Milán": "Internazionale",
    "Bayern de Múnich": "Bayern Munich",
    "Athletic Bilbao": "Athletic Club",
    "Estudiantes LP": "Estudiantes de La Plata",
    "Chivas de Guadalajara": "Guadalajara",
    "Junior FC": "Atlético Junior",
    "AFC Ajax": "Ajax Amsterdam",
    "Al-Hilal SFC": "Al Hilal",
    "Al-Ahli SFC": "Al Ahli",
    "Al-Nassr FC": "Al Nassr",
    "Al-Ittihad Club": "Al Ittihad",
    "Bournemouth": "AFC Bournemouth",
    "Real Madrid CF": "Real Madrid",
    "FC Barcelona": "Barcelona",
    "Sevilla FC": "Sevilla",
    "Valencia CF": "Valencia",
    "Getafe CF": "Getafe",
    "CA Osasuna": "Osasuna",
    "Villarreal CF": "Villarreal",
    "Chelsea FC": "Chelsea",
    "Arsenal FC": "Arsenal",
    "Liverpool FC": "Liverpool",
    "Brentford FC": "Brentford",
    "Fulham FC": "Fulham",
    "Everton FC": "Everton",
    "Juventus FC": "Juventus",
    "SSC Napoli": "Napoli",
    "Atalanta BC": "Atalanta",
    "ACF Fiorentina": "Fiorentina",
    "Torino FC": "Torino",
    "Bologna FC": "Bologna",
    "US Lecce": "Lecce",
    "Genoa CFC": "Genoa",
    "Udinese Calcio": "Udinese",
    "Cagliari Calcio": "Cagliari",
    "US Sassuolo": "Sassuolo",
    "SS Lazio": "Lazio",
    "Lille OSC": "Lille",
    "OGC Nice": "Nice",
    "RC Lens": "Lens",
    "RC Strasbourg": "Strasbourg",
    "Toulouse FC": "Toulouse",
    "SC Braga": "Braga",
    "SL Benfica": "Benfica",
    "Galatasaray SK": "Galatasaray",
    "Fenerbahçe SK": "Fenerbahce",
    "Beşiktaş JK": "Besiktas",
    "São Paulo FC": "São Paulo",
    "Santos FC": "Santos",
    "Club América": "América",
    "CF Monterrey": "Monterrey",
    "Millonarios FC": "Millonarios",
    "Racing Club": "Racing Club",
}


def norm(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    drop = {
        "fc", "cf", "ac", "as", "sc", "cd", "sd", "afc", "dc", "ssc", "us",
        "de", "del", "df", "ca", "bjk", "sk", "vfl", "vfb", "tsg", "sv",
        "rc", "rcd", "ud", "ogc", "sl", "ss",
    }
    return " ".join(t for t in text.split() if t and t not in drop)


def slugify(name):
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def snapshot_clubs():
    src = open(SNAPSHOT, encoding="utf-8").read()
    return [m[0] for m in re.findall(r'team\(\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"', src)]


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "11Eleven-crest-sync"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.load(resp)


def espn_teams():
    pool = {}
    for slug in LEAGUES:
        url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/teams"
        try:
            data = fetch_json(url)
        except Exception as exc:  # una liga caída no detiene el resto
            print(f"  ! {slug}: {exc}")
            continue
        for entry in data["sports"][0]["leagues"][0]["teams"]:
            team = entry["team"]
            logo = (team.get("logos") or [{}])[0].get("href")
            if not logo:
                continue
            record = {"name": team["displayName"], "logo": logo}
            for key in (team["displayName"], team.get("shortDisplayName"), team.get("abbreviation")):
                if key:
                    pool.setdefault(norm(key), record)
        time.sleep(0.3)
    return pool


def match(pool, clubs):
    result = {}
    missing = []
    for name in clubs:
        hit = pool.get(norm(OVERRIDE.get(name, name)))
        if hit is None:
            close = difflib.get_close_matches(norm(name), list(pool.keys()), n=1, cutoff=0.6)
            hit = pool[close[0]] if close else None
        if hit:
            result[name] = hit
        else:
            missing.append(name)
    return result, missing


def download(matches):
    os.makedirs(FOLDER, exist_ok=True)
    ok = 0
    for name, hit in matches.items():
        path = os.path.join(FOLDER, f"{slugify(name)}.png")
        if os.path.exists(path) and os.path.getsize(path) > 500:
            ok += 1
            continue
        req = urllib.request.Request(hit["logo"], headers={"User-Agent": "11Eleven-crest-sync"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        if len(data) < 300 or not data.startswith(b"\x89PNG"):
            print(f"  ! {name}: respuesta no válida")
            continue
        open(path, "wb").write(data)
        ok += 1
        time.sleep(0.05)
    return ok


# --- PNG 8-bit (RGBA/RGB/gray) reader + box downscaler, sin dependencias -----

def read_png(path):
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("no es PNG")
    pos, idat, ihdr = 8, b"", None
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        ctype = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + length]
        if ctype == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", payload)
        elif ctype == b"IDAT":
            idat += payload
        elif ctype == b"IEND":
            break
        pos += 12 + length
    w, h, depth, colour, _, _, interlace = ihdr
    if depth != 8 or interlace != 0 or colour not in (0, 2, 6):
        raise ValueError(f"formato no soportado depth={depth} colour={colour}")
    channels = {0: 1, 2: 3, 6: 4}[colour]
    raw = zlib.decompress(idat)
    stride = w * channels
    pixels = bytearray(h * stride)
    prev = bytearray(stride)
    cursor = 0
    for y in range(h):
        filt = raw[cursor]
        cursor += 1
        line = bytearray(raw[cursor : cursor + stride])
        cursor += stride
        if filt == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 255
        elif filt == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif filt == 3:
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 255
        elif filt == 4:
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                up = prev[i]
                upleft = prev[i - channels] if i >= channels else 0
                pa, pb, pc = abs(up - upleft), abs(left - upleft), abs(left + up - 2 * upleft)
                pred = left if (pa <= pb and pa <= pc) else (up if pb <= pc else upleft)
                line[i] = (line[i] + pred) & 255
        elif filt != 0:
            raise ValueError(f"filtro desconocido {filt}")
        pixels[y * stride : (y + 1) * stride] = line
        prev = line
    if colour == 6:
        return w, h, bytes(pixels)
    rgba = bytearray(w * h * 4)
    if colour == 2:
        for i in range(w * h):
            rgba[i * 4 : i * 4 + 3] = pixels[i * 3 : i * 3 + 3]
            rgba[i * 4 + 3] = 255
    else:
        for i in range(w * h):
            grey = pixels[i]
            rgba[i * 4 : i * 4 + 4] = bytes((grey, grey, grey, 255))
    return w, h, bytes(rgba)


def downsample(w, h, px, scale):
    if scale <= 1:
        return w, h, px
    nw, nh = w // scale, h // scale
    out = bytearray(nw * nh * 4)
    area = scale * scale
    cursor = 0
    for y in range(nh):
        for x in range(nw):
            r = g = b = a = 0
            for dy in range(scale):
                base = ((y * scale + dy) * w + x * scale) * 4
                for dx in range(scale):
                    i = base + dx * 4
                    r += px[i]
                    g += px[i + 1]
                    b += px[i + 2]
                    a += px[i + 3]
            out[cursor] = r // area
            out[cursor + 1] = g // area
            out[cursor + 2] = b // area
            out[cursor + 3] = a // area
            cursor += 4
    return nw, nh, bytes(out)


def png_chunk(ctype, payload):
    return (
        struct.pack(">I", len(payload))
        + ctype
        + payload
        + struct.pack(">I", zlib.crc32(ctype + payload) & 0xFFFFFFFF)
    )


def write_png(path, w, h, px):
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw += px[y * stride : (y + 1) * stride]
    out = b"\x89PNG\r\n\x1a\n"
    out += png_chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    out += png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    out += png_chunk(b"IEND", b"")
    open(path, "wb").write(out)


def optimize():
    before = after = 0
    failed = []
    for name in sorted(os.listdir(FOLDER)):
        if not name.endswith(".png"):
            continue
        path = os.path.join(FOLDER, name)
        before += os.path.getsize(path)
        try:
            w, h, px = read_png(path)
            scale = max(1, -(-max(w, h) // TARGET))
            nw, nh, small = downsample(w, h, px, scale)
            if (nw, nh) != (w, h):
                write_png(path, nw, nh, small)
                # valida el resultado decodificando lo que acabamos de escribir
                rw, rh, rpix = read_png(path)
                if (rw, rh) != (nw, nh) or rpix != small:
                    raise ValueError("la imagen reescrita no decodifica igual")
            after += os.path.getsize(path)
        except Exception as exc:
            failed.append((name, str(exc)))
            after += os.path.getsize(path)
    print(f"optimizados: {len(os.listdir(FOLDER))} archivos · "
          f"{before / 1e6:.2f} MB → {after / 1e6:.2f} MB")
    if failed:
        print("con errores (se conserva el original):", failed)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "fetch"
    if mode == "optimize":
        optimize()
        return
    clubs = snapshot_clubs()
    print(f"clubes en el snapshot: {len(clubs)}")
    pool = espn_teams()
    print(f"clubes indexados desde ESPN: {len(pool)}")
    matches, missing = match(pool, clubs)
    if missing:
        print("sin escudo:", missing)
    ok = download(matches)
    print(f"escudos en disco: {ok}")
    optimize()


if __name__ == "__main__":
    main()
