# 🌍 Sismos Centroamérica — Real-Time Seismic Architecture

[![Build and Deploy](https://github.com/ajuzadolfo/sismos-centroamerica/actions/workflows/deploy.yml/badge.svg)](https://github.com/ajuzadolfo/sismos-centroamerica/actions/workflows/deploy.yml)
[![Java 21](https://img.shields.io/badge/Java-21-orange.svg)](https://adoptium.net/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Angular 18](https://img.shields.io/badge/Angular-18-red.svg)](https://angular.dev/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre%20GL-3D%20Terrain-blue.svg)](https://maplibre.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL%2016-PostGIS%203.4-336791.svg)](https://postgis.net/)
[![Google Cloud](https://img.shields.io/badge/GCP-Cloud%20Run%20%7C%20Cloud%20SQL-4285F4.svg)](https://cloud.google.com/)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-844FBA.svg)](https://www.terraform.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

An enterprise-grade, event-driven cloud architecture engineered for real-time seismic monitoring, telemetry visualization, and crowdsourced earthquake perception across the Central American tectonic isthmus.

---

> [!WARNING]
> ### ⚠️ Critical Disclaimer & Public Safety Advisory
> **This platform is an experimental engineering reference architecture and educational/informational demonstrator.**
> - **It DOES NOT constitute an official governmental emergency warning system or authoritative source of seismic data.**
> - Data displayed is aggregated from third-party international scientific feeds (such as the USGS Earthquake Hazards Program) and experimental community telemetry.
> - **Citizens and emergency response personnel must always verify and rely upon official reports and instructions from the national scientific institutes and civil protection authorities of their respective countries.**

### 🏛️ Official National Seismological & Emergency Agencies in Central America

| Country | Official Monitoring Institute | National Civil Protection Agency |
| :--- | :--- | :--- |
| 🇬🇹 **Guatemala** | [INSIVUMEH](https://insivumeh.gob.gt/) (*Inst. Nac. de Sismología, Vulcanología, Meteorología e Hidrología*) | [CONRED](https://conred.gob.gt/) (*Coordinadora Nacional para la Reducción de Desastres*) |
| 🇸🇻 **El Salvador** | [MARN - Observatorio de Amenazas](https://www.marn.gob.sv/) (*Ministerio de Medio Ambiente*) | [Protección Civil El Salvador](http://www.proteccioncivil.gob.sv/) |
| 🇭🇳 **Honduras** | [COPECO](https://www.copeco.gob.hn/) (*Comisión Permanente de Contingencias*) | [COPECO Alertas y Respuestas](https://www.copeco.gob.hn/) |
| 🇳🇮 **Nicaragua** | [INETER](https://www.ineter.gob.ni/) (*Instituto Nicaragüense de Estudios Territoriales*) | [SINAPRED](https://www.sinapred.gob.ni/) (*Sistema Nacional para Prevención de Desastres*) |
| 🇨🇷 **Costa Rica** | [OVSICORI-UNA](http://www.ovsicori.una.ac.cr/) & [RSN (UCR-ICE)](https://rsn.ucr.ac.cr/) | [CNE](https://www.cne.go.cr/) (*Comisión Nacional de Emergencias*) |
| 🇵🇦 **Panamá** | [IGC-UP](http://www.igc.up.ac.pa/) (*Instituto de Geociencias - Universidad de Panamá*) | [SINAPROC](https://www.sinaproc.gob.pa/) (*Sistema Nacional de Protección Civil*) |

---

## 🏗️ High-Level System Architecture

The system demonstrates a resilient, reactive pipeline designed to ingest, spatially index, and broadcast seismic events with sub-second frontend latency while running entirely on serverless and managed cloud components.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CENTRAL AMERICA SEISMIC PIPELINE                      │
└─────────────────────────────────────────────────────────────────────────────────┘

   [USGS CDN / FDSN Feeds]
              │
              ▼ (Scheduled Ingestion / 60s)
   ┌──────────────────────────────────────────┐
   │ Spring Boot 3.3 (Java 21)                │
   │  • ShedLock Distributed Coordination     │
   │  • STOMP WebSocket Message Broker        │
   │  • Geospatial Distance Engine (PostGIS)  │
   └───────────────┬──────────────────────────┘
                   │
         Direct VPC│Egress (Private IP)
                   ▼
   ┌──────────────────────────────────────────┐
   │ Cloud SQL PostgreSQL 16 + PostGIS 3.4   │
   │  • Spatial GiST Index (geom, time)       │
   │  • Citizen Perception Aggregations       │
   └──────────────────────────────────────────┘

                   ▲
                   │ WebSocket (WSS) / REST API (HTTPS)
                   │
   ┌──────────────────────────────────────────┐
   │ Angular 18 (Standalone Signals + HMR)    │
   │  • MapLibre GL JS + DEM 3D Relief Mesh   │
   │  • Subduction Trench & Active Fault Lines│
   │  • Seismograph Waveform Audio Synthesizer│
   │  • Dynamic Bilingual Switcher (ES / EN)  │
   │  • Mobile Responsive (100dvh + Safe Area)│
   └──────────────────────────────────────────┘
```

---

## ✨ Key Features

- **🔴 Real-Time Streaming Telemetry:** Live earthquake feed dispatch over WebSocket (STOMP `/topic/earthquakes`) without client-side polling.
- **🗺️ Interactive 3D WebGL Geodynamics:** MapLibre GL JS with DEM elevation tiles, subduction zone trenches (Middle America Trench), active volcanoes, and hazard-striped geological faults.
- **👥 Crowdsourced "Did You Feel It?" Intensity System:** Community-driven perception reports with spatial clustering and spam protection.
- **🌐 Bilingual Localization (ES / EN):** Instant reactive language switching supporting Central America (UTC-6) and UTC timestamps.
- **📱 True Mobile Responsive Console:** Optimized for flagship and mid-range devices (e.g., Samsung Galaxy AMOLED screens) using dynamic viewport height (`100dvh`) and safe-area insets.
- **🔒 Enterprise Cloud & Security:**
  - Google Cloud Run with **Direct VPC Egress** to Private IP Cloud SQL (zero serverless VPC access connector overhead).
  - Keyless CI/CD with **Workload Identity Federation (WIF / OIDC)**.
  - Multi-environment isolation (`test` vs `prod`).
  - Infrastructure as Code with **Terraform**.

---

## 📦 Project Structure

```
.
├── backend/                  # Spring Boot 3.3 / Java 21 REST API & WebSocket Broker
│   ├── src/main/java/        # Ingestion jobs, PostGIS entities, STOMP controllers
│   ├── src/main/resources/   # Flyway spatial migrations & application profiles
│   └── Dockerfile            # Multi-stage container build
├── frontend/                 # Angular 18 Single Page Application
│   ├── src/app/components/   # Monitor, 3D Map, Timeline, Header, Filters, Landing
│   ├── src/app/services/     # WebSocket STOMP, Translation, Earthquake State
│   └── public/               # Vector branding, custom seismic favicons, map styles
├── infra/terraform/          # Infrastructure as Code for Google Cloud Platform
│   ├── main.tf               # Cloud Run, Cloud SQL PostGIS, VPC, Secret Manager
│   └── wif.tf                # Workload Identity Federation OIDC GitHub Deployer
├── .github/workflows/        # Automated test, build, and deploy GitHub Actions pipeline
└── docker-compose.yml        # Local development environment with PostGIS database
```

---

## 🚀 Quickstart & Local Development

### Prerequisites
- **Docker & Docker Compose** (v24+)
- **Java 21 JDK** (Eclipse Temurin or Amazon Corretto)
- **Node.js 20+** & **npm 10+**

### 1. Start the Local Database (PostgreSQL + PostGIS)
```bash
docker-compose up -d
```
This spins up PostgreSQL 16 with PostGIS enabled on port `5432`.

### 2. Run the Backend API
```bash
cd backend
./mvnw spring-boot:run
```
The backend initializes database tables via Flyway and runs on `http://localhost:8080`.
- Health check: `http://localhost:8080/actuator/health`
- WebSocket endpoint: `ws://localhost:8080/ws/seismic`

### 3. Run the Frontend Application
```bash
cd frontend
npm install
npm start
```
Open your browser at `http://localhost:4200` to access the interactive seismic console.

---

## ⚙️ Cloud Deployment & CI/CD Pipeline

The application features continuous deployment to Google Cloud Platform via `.github/workflows/deploy.yml`:

1. **Pull Requests / Commits to `develop`:** Triggers automated testing and staging deployment to the `test` environment (`sismos-centroamerica-test`).
2. **Releases to `main`:** Promotes revisions to production (`sismos-centroamerica-prod`).
3. **Authentication:** Pure OIDC Workload Identity Federation — **no permanent Google service account JSON keys are stored or exposed in GitHub Secrets**.

---

## 📄 License & Credits

Distributed under the MIT License. See [LICENSE](./LICENSE) for details.

Developed as a modern cloud-native architectural showcase by **Fozna Solutions 2026**.
