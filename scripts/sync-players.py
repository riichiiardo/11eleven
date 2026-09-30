#!/usr/bin/env python3
"""
11Eleven · SoFIFA → Supabase (staging del catálogo).

Baja el catálogo de jugadores de SoFIFA desde tu Mac (IP residencial: Cloudflare
pasa sin challenge) y sube cada página a Supabase (Postgres) con upsert por
`sofifa_id`. La app luego importa desde Supabase con la acción
`footballApi.syncCatalog` fuente `supabase`.

Requisitos:
  pip install requests supabase

Uso:
  # 1) Env de Supabase (opcional: sin él, solo imprime lo que subiría)
  export SUPABASE_URL="https://TU-PROYECTO.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."   # service_role, NO la anon

  # 2) Descarga y sube a Supabase
  python3 scripts/sync-players.py fetch

Notas:
  · La API JSON interna de SoFIFA es https://sofifa.com/api/players (60 por página).
  · Entre páginas hay una pausa de ~1.2 s para no disparar rate limits.
  · El upsert es idempotente: correr el script dos veces no duplica filas.
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

import requests

SOFIFA_URL = "https://sofifa.com/api/players"
PAGE_SIZE = 60            # SoFIFA devuelve 60 filas por página
PAGE_STEP = 60            # offset avanza de 60 en 60
MAX_PAGES = 400           # tope de seguridad (~24.000 jugadores)
PAUSE_SECONDS = 1.2

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

SUPABASE_TABLE = "sofifa_players"


def env(name: str) -> str | None:
    value = os.environ.get(name)
    return value.strip() if value and value.strip() else None


def supabase_client():
    url = env("SUPABASE_URL")
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    try:
        from supabase import create_client
    except ImportError:
        sys.exit(
            "Falta el paquete de Supabase. Instálalo con:\n"
            "  pip install supabase"
        )
    return create_client(url, key)


def fetch_page(offset: int, r: str = "270025") -> list[dict]:
    """Descarga una página de SoFIFA y devuelve las filas crudas."""
    params = {
        "r": r,
        "unit": "EUR",
        "offset": str(offset),
    }
    request = urllib.request.Request(
        f"{SOFIFA_URL}?{urllib.parse.urlencode(params)}", headers=BROWSER_HEADERS
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("players", "data", "results", "items"):
            inner = payload.get(key)
            if isinstance(inner, list):
                return inner
    return []


def to_row(raw: dict, r: str) -> dict | None:
    """Mapea una fila cruda de SoFIFA al shape de la tabla de staging."""
    sofifa_id = raw.get("id") or raw.get("player_id")
    name = raw.get("name") or raw.get("player") or raw.get("long_name")
    if not sofifa_id or not name:
        return None

    age = raw.get("age")
    if isinstance(age, str) and age.strip().isdigit():
        age = int(age)
    if not isinstance(age, (int, float)):
        age = None

    value = raw.get("value") or raw.get("value_eur") or raw.get("market_value") or 0
    try:
        value = int(value)
    except (TypeError, ValueError):
        value = 0

    club = raw.get("team") or raw.get("club") or raw.get("club_name") or ""

    return {
        "sofifa_id": int(sofifa_id),
        "name": str(name).strip(),
        "position": raw.get("position") or raw.get("best_position") or None,
        "ovr": raw.get("ovr") or raw.get("overall") or raw.get("rating") or None,
        "potential": raw.get("potential") or raw.get("pot") or None,
        "age": age,
        "value_eur": value,
        "nationality": raw.get("nationality") or raw.get("nation") or None,
        "club": club,
        "club_country": raw.get("club_country") or None,
        "league": raw.get("league") or raw.get("competition") or None,
        "photo_url": raw.get("photo_url") or raw.get("headshot") or None,
        "r": r,
    }


def upsert_batch(client, rows: list[dict]) -> None:
    """Upsert idempotente en Supabase (conflicto por sofifa_id)."""
    if not client:
        return
    response = (
        client.table(SUPABASE_TABLE)
        .upsert(rows, on_conflict="sofifa_id")
        .execute()
    )
    if getattr(response, "error", None):
        raise RuntimeError(f"Supabase devolvió un error: {response.error}")


def fetch(r: str) -> None:
    client = supabase_client()
    mode = "Supabase" if client else "SOLO IMPRESIÓN (define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)"
    print(f"Descargando jugadores de SoFIFA → {mode} …")

    total = 0
    for page in range(MAX_PAGES):
        offset = page * PAGE_STEP
        try:
            raws = fetch_page(offset, r)
        except Exception as cause:  # noqa: BLE001
            print(f"  página {page + 1}: error de red ({cause}); se reintenta en 5 s…")
            time.sleep(5)
            try:
                raws = fetch_page(offset, r)
            except Exception as cause2:  # noqa: BLE001
                print(f"  página {page + 1}: falló de nuevo ({cause2}); se detiene aquí.")
                break

        rows = [row for raw in raws if (row := to_row(raw, r))]
        if not rows:
            print(f"  página {page + 1}: sin filas válidas; fin del catálogo.")
            break

        if client:
            upsert_batch(client, rows)
        total += len(rows)
        print(
            f"  página {page + 1}: {len(rows)} filas "
            f"(total {total}, offset {offset})"
        )
        time.sleep(PAUSE_SECONDS)

    print(f"Listo: {total} filas procesadas desde SoFIFA.")


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else "fetch"
    if command == "fetch":
        fetch(r="270025")
    else:
        print(f"Comando desconocido: {command}. Usa: fetch")


if __name__ == "__main__":
    main()
