-- =====================================================================
-- BigQuery GIS - Detección Automática de Enjambres Sísmicos (ST_ClusterDBSCAN)
-- Identifica agrupamientos espaciotemporales de microsismicidad en Centroamérica
-- =====================================================================

WITH recent_events AS (
  SELECT
    event_id,
    title,
    magnitude,
    depth_km,
    event_time,
    latitude,
    longitude,
    point_geom
  FROM
    `sismos_analytics.earthquake_catalog`
  WHERE
    event_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
),

clustered_events AS (
  SELECT
    *,
    -- Agrupamiento DBSCAN: 25 km de distancia máxima, mínimo 5 eventos para formar cluster
    ST_ClusterDBSCAN(point_geom, 25000, 5) OVER () AS swarm_cluster_id
  FROM
    recent_events
)

SELECT
  swarm_cluster_id,
  COUNT(1) AS event_count,
  ROUND(MIN(magnitude), 1) AS min_magnitude,
  ROUND(MAX(magnitude), 1) AS max_magnitude,
  ROUND(AVG(magnitude), 2) AS avg_magnitude,
  ROUND(AVG(depth_km), 1) AS avg_depth_km,
  MIN(event_time) AS swarm_start_time,
  MAX(event_time) AS swarm_latest_time,
  -- Centroide geográfico del enjambre
  ST_CENTROID(ST_UNION_AGG(point_geom)) AS swarm_centroid_geom
FROM
  clustered_events
WHERE
  swarm_cluster_id IS NOT NULL
GROUP BY
  swarm_cluster_id
ORDER BY
  event_count DESC;
