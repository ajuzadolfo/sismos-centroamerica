variable "github_repository" {
  type        = string
  description = "Ruta del repositorio de GitHub (ejemplo: usuario/sismos-centroamerica). Dejar en blanco si aún no se ha configurado."
  default     = "ajuzadolfo/sismos-centroamerica"
}


# Solo se crea si se proporciona el repositorio de GitHub
resource "google_iam_workload_identity_pool" "github_pool" {
  count                     = var.github_repository != "" ? 1 : 0
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Identity pool for GitHub Actions CI/CD"
  depends_on                = [google_project_service.enabled_apis]
}

resource "google_iam_workload_identity_pool_provider" "github_provider" {
  count                              = var.github_repository != "" ? 1 : 0
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_pool[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions-provider"
  display_name                       = "GitHub Actions Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == '${var.github_repository}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "github_deployer" {
  count        = var.github_repository != "" ? 1 : 0
  account_id   = "github-deployer"
  display_name = "GitHub Actions CI/CD Deployer"
  description  = "Cuenta de servicio para despliegue automatizado desde GitHub Actions"
  depends_on   = [google_project_service.enabled_apis]
}

# Permisos mínimos para despliegue
locals {
  deployer_roles = [
    "roles/run.admin",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser",
    "roles/secretmanager.secretAccessor",
    "roles/cloudsql.client"
  ]
}

resource "google_project_iam_member" "deployer_roles" {
  for_each = var.github_repository != "" ? toset(local.deployer_roles) : []
  project  = var.project_id
  role     = each.key
  member   = "serviceAccount:${google_service_account.github_deployer[0].email}"
}

resource "google_service_account_iam_member" "wif_impersonation" {
  count              = var.github_repository != "" ? 1 : 0
  service_account_id = google_service_account.github_deployer[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_pool[0].name}/attribute.repository/${var.github_repository}"
}
