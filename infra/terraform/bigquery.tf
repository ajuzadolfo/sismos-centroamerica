# =====================================================================
# BigQuery GIS Data Lake y Streaming desde Cloud Pub/Sub
# =====================================================================

# 1. Dataset Analítico de Sismicidad
resource "google_bigquery_dataset" "sismos_analytics" {
  dataset_id                  = "sismos_analytics"
  friendly_name               = "Catálogo Sísmico Analítico de Centroamérica"
  description                 = "Data Lake analítico geoespacial de sismicidad (USGS 1980 - Presente)"
  location                    = var.region
  default_table_expiration_ms = null

  depends_on = [google_project_service.enabled_apis]
}

# 2. Tabla Particionada y Agrupada para Consultas Geoespaciales
resource "google_bigquery_table" "earthquake_catalog" {
  dataset_id = google_bigquery_dataset.sismos_analytics.dataset_id
  table_id   = "earthquake_catalog"

  description = "Catálogo histórico y en tiempo real particionado por fecha y agrupado por magnitud"

  time_partitioning {
    type  = "MONTH"
    field = "event_time"
  }

  clustering = ["magnitude", "depth_km", "country_code"]

  schema = <<EOF
[
  {"name": "event_id", "type": "STRING", "mode": "REQUIRED", "description": "Identificador único USGS"},
  {"name": "title", "type": "STRING", "mode": "NULLABLE", "description": "Título descriptivo"},
  {"name": "place", "type": "STRING", "mode": "NULLABLE", "description": "Ubicación geográfica"},
  {"name": "magnitude", "type": "NUMERIC", "mode": "REQUIRED", "description": "Magnitud"},
  {"name": "magnitude_type", "type": "STRING", "mode": "NULLABLE", "description": "Tipo de magnitud"},
  {"name": "depth_km", "type": "NUMERIC", "mode": "REQUIRED", "description": "Profundidad focal en km"},
  {"name": "event_time", "type": "TIMESTAMP", "mode": "REQUIRED", "description": "Marca de tiempo UTC"},
  {"name": "updated_time", "type": "TIMESTAMP", "mode": "NULLABLE", "description": "Última actualización"},
  {"name": "status", "type": "STRING", "mode": "NULLABLE", "description": "Estado de revisión"},
  {"name": "tsunami_flag", "type": "BOOLEAN", "mode": "NULLABLE", "description": "Alerta de tsunami"},
  {"name": "significance", "type": "INTEGER", "mode": "NULLABLE", "description": "Índice de significancia"},
  {"name": "latitude", "type": "FLOAT", "mode": "REQUIRED", "description": "Latitud WGS84"},
  {"name": "longitude", "type": "FLOAT", "mode": "REQUIRED", "description": "Longitud WGS84"},
  {"name": "point_geom", "type": "GEOGRAPHY", "mode": "NULLABLE", "description": "Punto geoespacial ST_GeogPoint"},
  {"name": "country_code", "type": "STRING", "mode": "NULLABLE", "description": "Código de país"},
  {"name": "ingested_at", "type": "TIMESTAMP", "mode": "REQUIRED", "description": "Fecha de ingestión"}
]
EOF

  depends_on = [google_bigquery_dataset.sismos_analytics]
}

# 3. Suscripción Nativa Pub/Sub a BigQuery para Ingesta en Streaming Directo
resource "google_pubsub_subscription" "bigquery_export_sub" {
  name  = "seismic-events-bigquery-sub"
  topic = google_pubsub_topic.seismic_events_topic.id

  bigquery_config {
    table            = "${var.project_id}.${google_bigquery_dataset.sismos_analytics.dataset_id}.${google_bigquery_table.earthquake_catalog.table_id}"
    use_topic_schema = false
    write_metadata   = true
  }

  depends_on = [
    google_bigquery_table.earthquake_catalog,
    google_pubsub_topic.seismic_events_topic
  ]
}
