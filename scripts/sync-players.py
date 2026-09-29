#!/usr/bin/env python3
"""
11Eleven — sincroniza los jugadores de Sofifa a public/players.json.

Uso:
    python3 scripts/sync-players.py fetch

La fuente es la API pública de Sofifa (https://api.sofifa.com/). Los datos
descargados se escriben en `public/players.json` para que el backend de Convex
pueda importarlos.

Nota: Si la API de Sofifa devuelve errores (p. ej. 429 Too Many Requests),
el script espera y reintenta automáticamente.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "public", "players.json")
API_BASE = "https://api.sofifa.com/v1/player"
HEADERS = {
    "User-Agent": "11Eleven-Sync/1.0 (fantasy-football-manager)",
    "Accept": "application/json",
}

# Fecha desde la cual descargar (año real; puedes ajustarlo a la temporada
# actual que necesites). El campo `since` de la API de Sofifa corresponde a un
# timestamp y `2024` funciona para obtener jugadores de esa época.
SINCE = 2024


def fetch_players_since(since):
    """Obtiene los jugadores de Sofifa desde una fecha dada, en lotes."""
    all_players = []
    offset = 0
    limit = 1000
    max_players = 3000  # límite razonable para evitar saturar la API

    while len(all_players) < max_players:
        url = f"{API_BASE}/?since={since}&offset={offset}&limit={limit}"
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print(f"HTTP error {e.code} para {url}")
            if e.code == 429:
                print("Demasiadas solicitudes. Esperando 5 segundos...")
                time.sleep(5)
                continue
            raise

        batch = data.get("players", [])
        if not batch:
            print("No se encontraron más jugadores.")
            break

        all_players.extend(batch)
        offset += limit
        time.sleep(0.1)  # delay para evitar 429

    return all_players


def clean_player(p):
    """Normaliza un jugador desde la respuesta de la API de Sofifa."""
    return {
        "id": p.get("id"),
        "name": p.get("name"),
        "short_name": p.get("short_name"),
        "nationality": p.get("nationality"),
        "date_of_birth": p.get("date_of_birth"),
        "club_name": p.get("club_name"),
        "club_country": p.get("club_country"),
        "club_short_name": p.get("club_short_name"),
        "position": p.get("position"),
        "position_short": p.get("position_short"),
        "photo": p.get("photo"),
        "height": p.get("height"),
        "weight": p.get("weight"),
        "age": p.get("age"),
        "ovr": p.get("ovr"),
        "potential": p.get("potential"),
        "skills": p.get("skills"),
        "weak_foot": p.get("weak_foot"),
        "international_reputation": p.get("international_reputation"),
        "pace": p.get("pace"),
        "shooting": p.get("shooting"),
        "passing": p.get("passing"),
        "dribbling": p.get("dribbling"),
        "defending": p.get("defending"),
        "physic": p.get("physic"),
        "gk_diving": p.get("gk_diving"),
        "gk_handling": p.get("gk_handling"),
        "gk_kicking": p.get("gk_kicking"),
        "gk_reflexes": p.get("gk_reflexes"),
        "gk_speed": p.get("gk_speed"),
        "createdAt": int(time.time() * 1000),
        "updatedAt": int(time.time() * 1000),
    }


def main():
    if len(sys.argv) < 2 or sys.argv[1] != "fetch":
        print("Uso: python3 scripts/sync-players.py fetch")
        sys.exit(1)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

    print(f"Descargando jugadores de Sofifa desde {SINCE}...")
    players = fetch_players_since(SINCE)
    print(f"Descargados {len(players)} jugadores.")

    if not players:
        print("Advertencia: no se encontraron jugadores. Verifica la API.")
        sys.exit(1)

    cleaned = [clean_player(p) for p in players]

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)

    size = os.path.getsize(OUTPUT)
    print(f"Datos guardados en {OUTPUT} ({size} bytes).")


if __name__ == "__main__":
    main()
