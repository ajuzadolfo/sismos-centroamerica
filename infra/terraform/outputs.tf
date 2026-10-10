output "project_id" {
  value       = var.project_id
  description = "ID del proyecto desplegado"
}

output "cloud_sql_connection_name" {
  value       = google_sql_database_instance.postgres_instance.connection_name
  description = "Nombre de conexión de la instancia de Cloud SQL"
}

output "cloud_sql_private_ip" {
  value       = google_sql_database_instance.postgres_instance.private_ip_address
  description = "IP privada interna de Cloud SQL"
}

output "cloudrun_subnet_name" {
  value       = google_compute_subnetwork.cloudrun_subnet.name
  description = "Nombre de la subred para Direct VPC Egress en Cloud Run"
}

output "artifact_registry_repo" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}"
  description = "URI del repositorio de imágenes Docker en Artifact Registry"
}

output "pubsub_topic_name" {
  value       = google_pubsub_topic.seismic_events_topic.name
  description = "Nombre del tema Pub/Sub para eventos sísmicos"
}

output "workload_identity_provider" {
  value       = length(google_iam_workload_identity_pool_provider.github_provider) > 0 ? google_iam_workload_identity_pool_provider.github_provider[0].name : ""
  description = "Identificador del proveedor WIF para GitHub Actions"
}

output "deployer_service_account" {
  value       = length(google_service_account.github_deployer) > 0 ? google_service_account.github_deployer[0].email : ""
  description = "Email de la Service Account que GitHub Actions suplantará"
}

