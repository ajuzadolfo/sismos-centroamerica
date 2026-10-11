-- =====================================================================
-- BigQuery GIS Data Lake - Catálogo Sísmico de Centroamérica
-- Particionamiento por fecha y agrupamiento espacial por magnitud y profundidad
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS `sismos_analytics`
OPTIONS (
  location = 'us-central1',
  description = 'Data Lake analítico geoespacial de sismicidad centroamericana'
);

CREATE TABLE IF NOT EXISTS `sismos_analytics.earthquake_catalog` (
  event_id STRING NOT NULL OPTIONS(description="Identificador único del sismo (USGS ID)"),
  title STRING OPTIONS(description="Título descriptivo del evento"),
  place STRING OPTIONS(description="Ubicación geográfica aproximada"),
  magnitude NUMERIC NOT NULL OPTIONS(description="Magnitud en escala momento o Richter"),
  magnitude_type STRING OPTIONS(description="Tipo de magnitud (Mw, mb, ml, etc.)"),
  depth_km NUMERIC NOT NULL OPTIONS(description="Profundidad focal en kilómetros"),
  event_time TIMESTAMP NOT NULL OPTIONS(description="Marca de tiempo UTC del evento"),
  updated_time TIMESTAMP OPTIONS(description="Última actualización de la solución sismológica"),
  status STRING OPTIONS(description="Estado de revisión (AUTOMATIC / REVIEWED)"),
  tsunami_flag BOOLEAN OPTIONS(description="Bandera de potencial tsunami"),
  significance INT64 OPTIONS(description="Índice de significancia compuesto"),
  latitude FLOAT64 NOT NULL OPTIONS(description="Latitud WGS84"),
  longitude FLOAT64 NOT NULL OPTIONS(description="Longitud WGS84"),
  point_geom GEOGRAPHY NOT NULL OPTIONS(description="Punto geoespacial WGS84 ST_GeogPoint"),
  country_code STRING OPTIONS(description="Código ISO del país o región centroamericana"),
  ingested_at TIMESTAMP NOT NULL OPTIONS(description="Fecha de ingestión en el Data Lake")
)
PARTITION BY DATE(event_time)
CLUSTER BY magnitude, depth_km, country_code
OPTIONS (
  require_partition_filter = FALSE,
  description = "Catálogo histórico y en tiempo real particionado para consultas BigQuery GIS de baja latencia"
);
