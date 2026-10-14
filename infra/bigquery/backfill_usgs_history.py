#!/usr/bin/env python3
"""
Script de Backfill Histórico del Catálogo Sísmico de Centroamérica (USGS FDSN 1980 - Presente).
Descarga eventos sísmicos de más de 40 años desde la API pública de USGS y genera un archivo
NDJSON (Newline Delimited JSON) listo para carga masiva ultra-rápida en BigQuery (bq load)
o ingestión directa mediante el SDK de Google Cloud BigQuery.

Uso:
  python backfill_usgs_history.py --year-start 1980 --year-end 2026 --output-file usgs_catalog_40y.json
  bq load --source_format=NEWLINE_DELIMITED_JSON sismos_analytics.earthquake_catalog usgs_catalog_40y.json
"""

import argparse
import datetime
import json
import logging
import sys
import time
import urllib.parse
import urllib.request

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("USGS-Backfill")

# Cuadrante sismotectónico de Centroamérica
BBOX = {
    "minlatitude": 6.5,
    "maxlatitude": 19.0,
    "minlongitude": -93.5,
    "maxlongitude": -76.0,
    "minmagnitude": 3.0
}

USGS_FDSN_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"

def transform_feature(feature: dict) -> dict:
    """Convierte una GeoJSON Feature de USGS al esquema de BigQuery earthquake_catalog.
    Descarta eventos con magnitud nula. La clasificación de países se delega a BigQuery
    mediante infra/bigquery/04_reclassify_countries.sql sobre sismos_analytics.country_boundaries.
    """
    props = feature.get("properties") or {}
    geom = feature.get("geometry") or {}
    coords = geom.get("coordinates") or [0.0, 0.0, 10.0]

    lon = float(coords[0])
    lat = float(coords[1])
    depth = float(coords[2]) if len(coords) > 2 else 10.0

    mag_raw = props.get("mag")
    if mag_raw is None:
        return None  # Descartar eventos sin magnitud válida (no inventar 3.0)

    mag = float(mag_raw)

    epoch_ms = props.get("time") or int(time.time() * 1000)
    event_time_iso = datetime.datetime.fromtimestamp(epoch_ms / 1000.0, tz=datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    updated_ms = props.get("updated")
    updated_time_iso = datetime.datetime.fromtimestamp(updated_ms / 1000.0, tz=datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S") if updated_ms else None

    return {
        "event_id": feature.get("id"),
        "title": props.get("title") or f"M {mag:.1f} - Central America",
        "place": props.get("place") or "Central America Region",
        "magnitude": mag,
        "magnitude_type": props.get("magType") or "mw",
        "depth_km": depth,
        "event_time": event_time_iso,
        "updated_time": updated_time_iso,
        "status": (props.get("status") or "REVIEWED").upper(),
        "tsunami_flag": bool(props.get("tsunami") == 1),
        "significance": int(props.get("sig") or 100),
        "latitude": lat,
        "longitude": lon,
        "country_code": None,  # Asignado posteriormente por 04_reclassify_countries.sql
        "ingested_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    }


def fetch_year(year: int) -> list:
    """Consulta los eventos de un año específico en la API FDSN"""
    start_time = f"{year}-01-01T00:00:00"
    end_time = f"{year + 1}-01-01T00:00:00"

    params = {
        "format": "geojson",
        "starttime": start_time,
        "endtime": end_time,
        "minmagnitude": BBOX["minmagnitude"],
        "minlatitude": BBOX["minlatitude"],
        "maxlatitude": BBOX["maxlatitude"],
        "minlongitude": BBOX["minlongitude"],
        "maxlongitude": BBOX["maxlongitude"]
    }

    url = f"{USGS_FDSN_URL}?{urllib.parse.urlencode(params)}"
    logger.info(f"Consultando año {year}: {url}")

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Fozna-Seismic-DataLake-Backfill/1.0 (foznasolutions.com)"}
    )

    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                features = data.get("features", [])
                logger.info(f"Año {year}: {len(features)} eventos recuperados.")
                transformed = [transform_feature(f) for f in features]
                valid_events = [ev for ev in transformed if ev is not None]
                if len(transformed) != len(valid_events):
                    logger.info(f"Año {year}: {len(transformed) - len(valid_events)} eventos descartados por carecer de magnitud.")
                return valid_events
        except Exception as e:
            logger.warning(f"Intento {attempt + 1}/3 falló para el año {year}: {e}")
            time.sleep(2 * (attempt + 1))

    logger.error(f"Error permanente al obtener eventos para el año {year}")
    return []


def main():
    parser = argparse.ArgumentParser(description="Backfill histórico USGS para BigQuery GIS")
    parser.add_argument("--year-start", type=int, default=1980, help="Año inicial (mínimo 1980)")
    parser.add_argument("--year-end", type=int, default=datetime.datetime.now().year, help="Año final")
    parser.add_argument("--output-file", type=str, default="usgs_historical_catalog.ndjson", help="Ruta del archivo de salida NDJSON")
    args = parser.parse_args()

    total_events = 0
    logger.info(f"Iniciando descarga histórica de USGS ({args.year_start} - {args.year_end})...")

    with open(args.output_file, "w", encoding="utf-8") as out:
        for year in range(args.year_start, args.year_end + 1):
            events = fetch_year(year)
            for ev in events:
                out.write(json.dumps(ev, ensure_ascii=False) + "\n")
            total_events += len(events)
            time.sleep(0.5)  # Respetar rate-limit de USGS

    logger.info(f"✅ Descarga completada con éxito. Total eventos exportados: {total_events}")
    logger.info(f"Archivo guardado en: {args.output_file}")
    logger.info("Pasos siguientes para BigQuery:")
    logger.info(f"  1. Cargar catálogo:\n     bq load --source_format=NEWLINE_DELIMITED_JSON sismos_analytics.earthquake_catalog {args.output_file}")
    logger.info("  2. Ejecutar script de clasificación de países geográfica real:")
    logger.info("     bq query --use_legacy_sql=false < infra/bigquery/04_reclassify_countries.sql")


if __name__ == "__main__":
    main()
