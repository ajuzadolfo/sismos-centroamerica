# =====================================================================
# Google Cloud Armor (WAF L7 / Rate Limiting) y Cloud CDN
# Protección perimetral para alta concurrencia durante crisis sísmicas
# =====================================================================

# 1. Política de Seguridad Cloud Armor
resource "google_compute_security_policy" "cloud_armor_policy" {
  name        = "sismos-cloud-armor-${var.environment}"
  description = "Política de protección L7: Rate-limiting anti-DDoS y mitigación de abusos"

  # Regla 1: Rate Limiting (Máximo 120 peticiones / minuto por IP de origen)
  rule {
    action   = "throttle"
    priority = 1000
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 120
        interval_sec = 60
      }
    }
    description = "Prevenir scraping masivo y saturación de la API (120 req/min)"
  }

  # Regla 2: Regla básica WAF contra Inyecciones SQL comunes
  rule {
    action   = "deny(403)"
    priority = 2000
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Mitigación automática WAF contra SQL Injection"
  }

  # Regla Default: Permitir tráfico legítimo
  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Regla predeterminada de acceso general"
  }

  depends_on = [google_project_service.enabled_apis]
}

# 2. Serverless Network Endpoint Groups (NEG) para Cloud Run
resource "google_compute_region_network_endpoint_group" "frontend_neg" {
  name                  = "sismos-frontend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  cloud_run {
    service = "sismos-frontend"
  }
  depends_on = [google_project_service.enabled_apis]
}

resource "google_compute_region_network_endpoint_group" "backend_neg" {
  name                  = "sismos-backend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  cloud_run {
    service = "sismos-backend"
  }
  depends_on = [google_project_service.enabled_apis]
}

# 3. Backend Service para Frontend con Cloud CDN Habilitado
resource "google_compute_backend_service" "frontend_backend_service" {
  name            = "sismos-frontend-backend-svc"
  protocol        = "HTTP"
  port_name       = "http"
  timeout_sec     = 30
  enable_cdn      = true
  security_policy = google_compute_security_policy.cloud_armor_policy.id

  backend {
    group = google_compute_region_network_endpoint_group.frontend_neg.id
  }

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    default_ttl                  = 3600
    max_ttl                      = 86400
    client_ttl                   = 3600
    negative_caching             = true
    serve_while_stale            = 86400
  }
}

# 4. Backend Service para API Backend (Sin CDN estático para respuestas dinámicas)
resource "google_compute_backend_service" "backend_api_service" {
  name            = "sismos-api-backend-svc"
  protocol        = "HTTP"
  port_name       = "http"
  timeout_sec     = 60
  enable_cdn      = false
  security_policy = google_compute_security_policy.cloud_armor_policy.id

  backend {
    group = google_compute_region_network_endpoint_group.backend_neg.id
  }
}
