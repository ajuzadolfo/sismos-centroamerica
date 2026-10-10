variable "project_id" {
  type        = string
  description = "ID del proyecto en Google Cloud Platform"
  default     = "sismos-centroamerica-test"
}

variable "region" {
  type        = string
  description = "Región de Google Cloud para el despliegue de recursos"
  default     = "us-central1"
}

variable "environment" {
  type        = string
  description = "Entorno (test o prod)"
  default     = "test"
}

variable "db_tier" {
  type        = string
  description = "Tipo de máquina para la instancia de Cloud SQL (mínimo recomendado para PostGIS)"
  default     = "db-custom-1-3840"
}

variable "db_disk_size" {
  type        = number
  description = "Tamaño inicial del disco SSD en GB"
  default     = 10
}
