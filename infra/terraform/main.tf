terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.25"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. Habilitación de APIs necesarias
locals {
  apis = [
    "cloudresourcemanager.googleapis.com",
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "pubsub.googleapis.com",
    "bigquery.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com"
  ]
}

resource "google_project_service" "enabled_apis" {
  for_each                   = toset(local.apis)
  project                    = var.project_id
  service                    = each.key
  disable_dependent_services = false
  disable_on_destroy         = false
}

# 2. Red VPC y Subred para Direct VPC Egress
resource "google_compute_network" "sismos_vpc" {
  name                    = "sismos-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.enabled_apis]
}

resource "google_compute_subnetwork" "cloudrun_subnet" {
  name          = "cloudrun-subnet"
  ip_cidr_range = "10.0.1.0/24"
  region        = var.region
  network       = google_compute_network.sismos_vpc.id
}

# 3. Peering IP Privada para Cloud SQL (Service Networking)
resource "google_compute_global_address" "private_ip_alloc" {
  name          = "sismos-private-ip-alloc"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.sismos_vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.sismos_vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_alloc.name]
}

# 4. Almacenamiento de Contenedores (Artifact Registry)
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "sismos-repo"
  description   = "Repositorio Docker para microservicios de monitorización sísmica"
  format        = "DOCKER"
  depends_on    = [google_project_service.enabled_apis]
}

# 5. Bus de Eventos Distribuido (Cloud Pub/Sub)
resource "google_pubsub_topic" "seismic_events_topic" {
  name       = "seismic-events-topic"
  depends_on = [google_project_service.enabled_apis]
}

# 6. Contraseña Aleatoria y Secret Manager para la Base de Datos
resource "random_password" "db_password" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "google_secret_manager_secret" "db_password_secret" {
  secret_id  = "db-password"
  depends_on = [google_project_service.enabled_apis]

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password_version" {
  secret      = google_secret_manager_secret.db_password_secret.id
  secret_data = random_password.db_password.result
}

# 7. Instancia de Cloud SQL PostgreSQL 16
resource "google_sql_database_instance" "postgres_instance" {
  name             = "sismos-pg-${var.environment}"
  database_version = "POSTGRES_16"
  region           = var.region
  deletion_protection = false # Permitir destruir en entorno de pruebas si hiciera falta

  depends_on = [
    google_service_networking_connection.private_vpc_connection,
    google_project_service.enabled_apis
  ]

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_size         = var.db_disk_size
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled    = true  # Permite conexión segura mediante Cloud SQL Auth Proxy desde Cloud Shell/local
      private_network = google_compute_network.sismos_vpc.id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = var.environment == "prod"
      start_time                     = "03:00"
    }

    database_flags {
      name  = "cloudsql.enable_pgaudit"
      value = "on"
    }
  }
}

# Base de datos principal
resource "google_sql_database" "sismos_db" {
  name     = "sismos_db"
  instance = google_sql_database_instance.postgres_instance.name
}

# Usuario de la aplicación
resource "google_sql_user" "app_user" {
  name     = "sismos_app"
  instance = google_sql_database_instance.postgres_instance.name
  password = random_password.db_password.result
}
