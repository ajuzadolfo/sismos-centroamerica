-- =====================================================================
-- BigQuery GIS: Reclasificación geográfica oficial del catálogo sísmico
-- Basado en fronteras Natural Earth WGS84 (ST_CONTAINS y ST_DWITHIN a 100km)
-- =====================================================================

-- 1. Definición de tabla de fronteras de países
CREATE TABLE IF NOT EXISTS `sismos_analytics.country_boundaries` (
  iso2 STRING NOT NULL OPTIONS(description="Código ISO 2 del país"),
  name_es STRING NOT NULL OPTIONS(description="Nombre en español"),
  geom GEOGRAPHY NOT NULL OPTIONS(description="Polígono MultiPolygon WGS84")
);

-- 2. Actualización de country_code en el catálogo mediante UPDATE ... FROM
-- Reglas sismológicas de Centroamérica:
--  1. Sismo en tierra (ST_CONTAINS) -> país respectivo.
--  2. Sismo marino cercano <= 100 km (ST_DWITHIN) -> país costero más cercano.
--  3. Sismo lejano > 100 km de la costa -> 'OC' (Océano abierto).
--  4. México, Belice, Colombia -> 'EXT' (Exterior / fuera de Centroamérica sísmica).

UPDATE `sismos_analytics.earthquake_catalog` AS target
SET country_code = src.assigned_code
FROM (
  WITH land_matches AS (
    SELECT
      e.event_id,
      e.event_time,
      CASE WHEN cb.iso2 IN ('MX', 'BZ', 'CO') THEN 'EXT' ELSE cb.iso2 END AS assigned_code,
      ROW_NUMBER() OVER(PARTITION BY e.event_id, e.event_time ORDER BY cb.iso2) AS rn
    FROM `sismos_analytics.earthquake_catalog` e
    JOIN `sismos_analytics.country_boundaries` cb
      ON ST_CONTAINS(cb.geom, ST_GEOGPOINT(e.longitude, e.latitude))
  ),
  offshore_matches AS (
    SELECT
      e.event_id,
      e.event_time,
      CASE WHEN cb.iso2 IN ('MX', 'BZ', 'CO') THEN 'EXT' ELSE cb.iso2 END AS assigned_code,
      ROW_NUMBER() OVER(
        PARTITION BY e.event_id, e.event_time 
        ORDER BY ST_DISTANCE(cb.geom, ST_GEOGPOINT(e.longitude, e.latitude)) ASC
      ) AS rn
    FROM `sismos_analytics.earthquake_catalog` e
    JOIN `sismos_analytics.country_boundaries` cb
      ON ST_DWITHIN(cb.geom, ST_GEOGPOINT(e.longitude, e.latitude), 100000)
    LEFT JOIN (SELECT event_id, event_time FROM land_matches WHERE rn = 1) lm
      ON e.event_id = lm.event_id AND e.event_time = lm.event_time
    WHERE lm.event_id IS NULL
  ),
  all_classified AS (
    SELECT event_id, event_time, assigned_code FROM land_matches WHERE rn = 1
    UNION ALL
    SELECT event_id, event_time, assigned_code FROM offshore_matches WHERE rn = 1
  )
  SELECT
    e.event_id,
    e.event_time,
    COALESCE(c.assigned_code, 'OC') AS assigned_code
  FROM (
    SELECT DISTINCT event_id, event_time FROM `sismos_analytics.earthquake_catalog`
  ) e
  LEFT JOIN all_classified c
    ON e.event_id = c.event_id AND e.event_time = c.event_time
) AS src
WHERE target.event_id = src.event_id
  AND target.event_time = src.event_time;
