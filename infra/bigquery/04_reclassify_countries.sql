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

-- 2. Actualización de country_code en el catálogo
-- Regla de asignación:
--  1. Sismo en tierra (ST_CONTAINS) -> país respectivo.
--  2. Sismo marino cercano <= 100 km (ST_DWITHIN) -> país costero más cercano.
--  3. Sismo lejano > 100 km de la costa -> 'OC' (Océano).
--  4. México, Belice, Colombia -> 'EXT' (Fuera de Centroamérica).

UPDATE `sismos_analytics.earthquake_catalog` e
SET country_code = (
  WITH matched AS (
    -- 1. Contenido en tierra
    SELECT
      CASE 
        WHEN cb.iso2 IN ('MX', 'BZ', 'CO') THEN 'EXT'
        ELSE cb.iso2
      END AS assigned_code,
      0 AS priority,
      0.0 AS distance_m
    FROM `sismos_analytics.country_boundaries` cb
    WHERE ST_CONTAINS(cb.geom, e.point_geom)
    
    UNION ALL
    
    -- 2. Marino a <= 100 km (solo si no está dentro de ningún polígono)
    SELECT
      CASE 
        WHEN cb.iso2 IN ('MX', 'BZ', 'CO') THEN 'EXT'
        ELSE cb.iso2
      END AS assigned_code,
      1 AS priority,
      ST_DISTANCE(cb.geom, e.point_geom) AS distance_m
    FROM `sismos_analytics.country_boundaries` cb
    WHERE NOT EXISTS (
      SELECT 1 FROM `sismos_analytics.country_boundaries` c1 
      WHERE ST_CONTAINS(c1.geom, e.point_geom)
    )
    AND ST_DWITHIN(cb.geom, e.point_geom, 100000)
    ORDER BY priority ASC, distance_m ASC
    LIMIT 1
  )
  SELECT COALESCE((SELECT assigned_code FROM matched), 'OC')
)
WHERE TRUE;
