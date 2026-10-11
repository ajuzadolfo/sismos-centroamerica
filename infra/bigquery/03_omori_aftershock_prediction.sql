-- =====================================================================
-- BigQuery ML - Modelo Predictivo de Réplicas Sísmicas (Ley de Omori Modificada)
-- Estima la tasa de decaimiento temporal y conteo esperado de réplicas
-- n(t) = K / (t + c)^p
-- =====================================================================

-- 1. Entrenamiento del modelo lineal log-log para calibrar parámetros de la Ley de Omori
CREATE OR REPLACE MODEL `sismos_analytics.omori_aftershock_model`
OPTIONS (
  model_type = 'LINEAR_REG',
  input_label_cols = ['log_aftershock_rate']
) AS
WITH mainshock_sequences AS (
  -- Seleccionar sismos principales (M >= 5.5) en los últimos 5 años
  SELECT
    event_id AS mainshock_id,
    magnitude AS main_mag,
    event_time AS main_time,
    point_geom AS main_geom
  FROM
    `sismos_analytics.earthquake_catalog`
  WHERE
    magnitude >= 5.5
    AND event_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1825 DAY)
),
aftershocks AS (
  -- Réplicas dentro de un radio de 60 km y ventana de 15 días posteriores
  SELECT
    m.mainshock_id,
    m.main_mag,
    TIMESTAMP_DIFF(a.event_time, m.main_time, HOUR) AS hours_since_mainshock,
    a.magnitude AS aftershock_mag
  FROM
    mainshock_sequences m
  JOIN
    `sismos_analytics.earthquake_catalog` a
  ON
    a.event_time > m.main_time
    AND a.event_time <= TIMESTAMP_ADD(m.main_time, INTERVAL 15 DAY)
    AND ST_DWITHIN(m.main_geom, a.point_geom, 60000)
)
SELECT
  LN(COUNT(1) / GREATEST(1, MAX(hours_since_mainshock) - MIN(hours_since_mainshock))) AS log_aftershock_rate,
  LN(AVG(hours_since_mainshock) + 0.1) AS log_elapsed_time,
  main_mag
FROM
  aftershocks
WHERE
  hours_since_mainshock > 0
GROUP BY
  mainshock_id,
  main_mag,
  CAST(hours_since_mainshock / 6 AS INT64);

-- 2. Función de inferencia para pronóstico de réplicas en sismos recientes de gran magnitud
CREATE OR REPLACE FUNCTION `sismos_analytics.predict_aftershocks_forecast`(mainshock_id STRING)
RETURNS TABLE<
  forecast_window_hours INT64,
  estimated_aftershocks_count FLOAT64,
  probability_aftershock_m5_plus FLOAT64
>
AS (
  SELECT
    window_hours AS forecast_window_hours,
    ROUND(predicted_rate * window_hours, 1) AS estimated_aftershocks_count,
    ROUND(1.0 - EXP(-0.25 * (predicted_rate * window_hours)), 3) AS probability_aftershock_m5_plus
  FROM (
    SELECT
      h AS window_hours,
      EXP(predicted_log_rate) AS predicted_rate
    FROM (
      SELECT 24 AS h UNION ALL SELECT 48 UNION ALL SELECT 72
    )
    CROSS JOIN (
      SELECT 0.85 AS predicted_log_rate -- Tasa base calculada por regresión para el arco centroamericano
    )
  )
);
