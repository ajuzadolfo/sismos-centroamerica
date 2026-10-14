#!/usr/bin/env python3
"""
Carga las geometrías oficiales de los países de Centroamérica (y limítrofes)
en BigQuery (sismos_analytics.country_boundaries) para la reclasificación espacial.
"""
import json
import os
import sys

def main():
    project_id = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PROJECT_ID", "sismos-centroamerica-test")
    
    geojson_path = os.path.join(os.path.dirname(__file__), "../../backend/src/main/resources/geo/central_america_admin0.geojson")
    with open(geojson_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    rows = []
    for feature in data.get("features", []):
        iso2 = feature["properties"]["iso2"]
        name_es = feature["properties"]["name_es"]
        geom = feature["geometry"]
        coords = geom["coordinates"]
        
        # Si tiene 3 niveles de anidación, representarlo como Polygon válido para BigQuery
        if geom["type"] == "MultiPolygon" and len(coords) > 0 and len(coords[0]) > 0 and isinstance(coords[0][0][0], (int, float)):
            geom_dict = {"type": "Polygon", "coordinates": coords}
        else:
            geom_dict = geom
            
        rows.append((iso2, name_es, json.dumps(geom_dict)))

    values_sql = ",\n".join([
        f"  ('{r[0]}', '{r[1]}', ST_GEOGFROMGEOJSON('{r[2]}', make_valid => TRUE))"
        for r in rows
    ])

    sql = f"""-- =====================================================================
-- Poblar geometrías WGS84 de países en sismos_analytics.country_boundaries
-- =====================================================================

CREATE TABLE IF NOT EXISTS `sismos_analytics.country_boundaries` (
  iso2 STRING NOT NULL OPTIONS(description="Código ISO 2 del país"),
  name_es STRING NOT NULL OPTIONS(description="Nombre en español"),
  geom GEOGRAPHY NOT NULL OPTIONS(description="Polígono MultiPolygon WGS84")
);

DELETE FROM `sismos_analytics.country_boundaries` WHERE TRUE;

INSERT INTO `sismos_analytics.country_boundaries` (iso2, name_es, geom)
VALUES
{values_sql};
"""

    output_sql_path = os.path.join(os.path.dirname(__file__), "05_populate_country_boundaries.sql")
    with open(output_sql_path, "w", encoding="utf-8") as f:
        f.write(sql)
    print(f"Generated {output_sql_path} with {len(rows)} countries.")

    # Si google-cloud-bigquery está instalado y se invoca directamente, ejecutar contra BigQuery
    try:
        from google.cloud import bigquery
        client = bigquery.Client(project=project_id)
        print(f"Executing directly against BigQuery project: {project_id}...")
        for statement in sql.split(";\n\n"):
            stmt = statement.strip()
            if stmt:
                client.query(stmt).result()
        print(f"Successfully populated sismos_analytics.country_boundaries in {project_id}")
    except ImportError:
        print("google-cloud-bigquery not installed locally. You can execute 05_populate_country_boundaries.sql via 'bq query'.")

if __name__ == "__main__":
    main()
