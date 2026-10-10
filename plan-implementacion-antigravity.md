# Plan de Implementación Técnica: Plataforma de Monitorización Sísmica en Centroamérica
**Destinatario:** Google Antigravity / Equipo de Ingeniería  
**Versión:** 1.1.0 (Revisada y Optimizada para Producción Multi-Instancia)  
**Entornos:** Test (Staging) y Producción (Público)  
**Stack Principal:** Angular 18 (PWA, MapLibre GL JS, Signals), Spring Boot 3 (Hibernate Spatial, JTS, ShedLock), Cloud SQL PostgreSQL 16 con PostGIS, Google Cloud Run (Direct VPC Egress), Google Cloud Pub/Sub / Redis, GitHub Actions (Workload Identity Federation).

---

## 1. Resumen Ejecutivo y Objetivos de Arquitectura

El presente plan define la hoja de ruta de implementación técnica y operativa para desplegar una plataforma moderna, reactiva y elástica para la monitorización de sismos en Centroamérica. El diseño supera directamente las limitaciones identificadas en los portales institucionales de la región (tablas HTML estáticas, necesidad de recarga manual, formularios lentos y dependencia de redes sociales durante emergencias).

### Pilares Fundamentales
1. **Ingesta Continua y Abierta:** Consumo automatizado y de baja latencia mediante feed CDN GeoJSON de la USGS (`summary/all_hour.geojson`) combinado con consultas FDSN incrementales, acotado al cuadrante regional de Centroamérica (Latitud 7.0° a 18.5° N, Longitud -93.0° a -77.0° O).
2. **Motor Geoespacial Nativo:** Modelo de datos espaciotemporal en PostgreSQL con la extensión PostGIS e indexación GiST compuesta para responder consultas de proximidad y delimitación en milisegundos (< 50 ms).
3. **Distribución Reactiva Multi-Instancia:** Transmisión inmediata de eventos nuevos hacia clientes web mediante WebSockets/STOMP respaldados por un bus de eventos distribuido (Google Cloud Pub/Sub o Redis), garantizando entrega en < 1 segundo incluso con escalado horizontal en Cloud Run.
4. **Visualización Cartográfica de Alto Rendimiento:** Frontend en Angular como Progressive Web App (PWA) con aceleración gráfica WebGL (MapLibre GL JS) sobre tiles vectoriales abiertos (CARTO / OpenFreeMap), optimizado con Angular Signals para renderizado constante a 60 fps con clustering, mapas de calor y reproducción cronológica.
5. **Sismología Ciudadana Ágil y Protegida:** Sistema de reporte comunitario de percepción ("¿Lo sentiste?") basado en micro-interacciones visuales rápidas, validación espacial de plausibilidad geodésica y agregación de calor en tiempo real.
6. **Despliegue Serverless Seguro y Eficiente:** Infraestructura segregada en Google Cloud Run y Cloud SQL con Direct VPC Egress (sin coste fijo de conectores legacy), gestión de concurrencia distribuida (ShedLock), asignación continua de CPU y CI/CD automatizado con GitHub Actions vía Workload Identity Federation (WIF).

---

## 2. Definición del Stack Tecnológico

| Capa / Dominio | Tecnología Seleccionada | Rol y Justificación en la Arquitectura |
| :--- | :--- | :--- |
| **Frontend Web** | Angular 18+ (PWA, Signals, OnPush) | SPA reactiva con Service Workers para capacidades offline, notificaciones y control de ciclo de vida con Signals para alto rendimiento gráfico. |
| **Motor Cartográfico** | MapLibre GL JS (`ngx-maplibre-gl`) | Renderizado vectorial acelerado por GPU (WebGL), clustering dinámico y mapas de calor (*heatmaps*). |
| **Tiles de Mapa Base** | CARTO Basemaps / OpenFreeMap | Proveedores vectoriales abiertos y de alto contraste (estilos claro y oscuro) sin dependencias ni costes de API keys privativas. |
| **Tiempo Real (Cliente)** | `@stomp/stompjs` + RxJS | Suscripción reactiva con reconexión automática (*exponential backoff*) y sincronización REST post-corte. |
| **Backend Core** | Java 21 / Spring Boot 3.x | Monolito modular elástico con Spring Web, Spring Scheduling y Spring WebSocket. |
| **Capa Geoespacial Java** | Hibernate Spatial + JTS Core | Mapeo objeto-relacional de geometrías nativas WGS 84 (`Point`, `Polygon`, `LineString`). |
| **Coordinación Distribuida** | ShedLock (sobre PostgreSQL) | Bloqueo distribuido para garantizar que una única réplica de Cloud Run ejecute la tarea de ingesta periódica. |
| **Bus de Eventos (Multi-Nodo)** | Google Cloud Pub/Sub o Redis | Relay de mensajería para propagar sismos en tiempo real a través de todas las instancias activas de Cloud Run. |
| **Base de Datos** | PostgreSQL 16 (Google Cloud SQL) | Motor relacional administrado con alta disponibilidad multi-zona en producción. |
| **Extensiones BD** | `postgis`, `btree_gist` | Soporte de cálculo geoespacial e índices compuestos GiST (`geom`, `time`). |
| **Ingesta Externa** | USGS CDN Feed & FDSN Catalog | Feed GeoJSON pre-generado de alta disponibilidad y API FDSN sin API key para históricos. |
| **Contenedores** | Docker | Empaquetado estándar multi-stage para desarrollo local y ejecución en la nube. |
| **Cómputo Cloud** | Google Cloud Run (CPU Always Allocated) | Cómputo serverless con Direct VPC Egress, timeout extendido (3600s) y soporte WebSocket persistente. |
| **Seguridad CI/CD** | Workload Identity Federation | Autenticación federada entre GitHub Actions y GCP basada en tokens OIDC efímeros sin claves JSON. |
| **Automatización** | GitHub Actions | Pipelines continuos para pruebas, compilación, publicación en Artifact Registry y despliegue. |

---

## 3. Hoja de Ruta de Implementación por Fases

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CRONOGRAMA DE EJECUCIÓN                         │
├────────────┬───────────────────────────────────────────────────────────┤
│ Fase 1     │ Aprovisionamiento de GCP, Cloud SQL y WIF (COMPLETADA)    │
│ Fase 2     │ Modelo Geoespacial PostGIS, Flyway y Entidades (COMPLETADA│
│ Fase 3     │ Ingesta Automática USGS (CDN + FDSN) (COMPLETADA)         │
│ Fase 4     │ Streaming Distribuido (WebSockets/STOMP) (COMPLETADA)     │
│ Fase 5     │ Frontend Angular (Signals), MapLibre GL JS (COMPLETADA)   │
│ Fase 6     │ Sismología Ciudadana y Validación Espacial (COMPLETADA)   │
│ Fase 7     │ CI/CD en GitHub Actions y Despliegue Cloud Run Optimizado  │
│ Fase 8     │ Pruebas de Carga Multi-Instancia y Criterios de Éxito     │
└────────────┴───────────────────────────────────────────────────────────┘
```

---

### Fase 1: Aprovisionamiento de Infraestructura en Google Cloud

#### 1.1 Segregación de Proyectos
- Crear dos proyectos independientes en Google Cloud Platform:
  - `sismos-centroamerica-test` (integración y pruebas técnicas).
  - `sismos-centroamerica-prod` (servicio público en producción).
- Habilitar APIs necesarias en ambos proyectos: Cloud SQL Admin, Cloud Run, Artifact Registry, Secret Manager, Cloud Pub/Sub y Compute Engine API.

#### 1.2 Redes y Conectividad Eficiente (Direct VPC Egress)
- Crear una red VPC personalizada con asignación de rango IP privado para Cloud SQL.
- Utilizar **Direct VPC Egress** en Cloud Run (asociando la subred directamente al servicio Cloud Run) para comunicar Cloud Run con Cloud SQL internamente sin necesidad de desplegar conectores Serverless VPC Access dedicados, eliminando costes fijos innecesarios y reduciendo la latencia de red.

#### 1.3 Instancias de Cloud SQL (PostgreSQL 16)
- **Configuración de Test:**
  - Nivel de máquina: `db-f1-micro` o `db-g1-small` (1 vCPU, 1.7 GB RAM).
  - Zona única (Single Zone) para optimizar costos.
  - Almacenamiento SSD: 10 GB con incremento automático habilitado.
- **Configuración de Producción:**
  - Nivel de máquina: `db-custom-2-7680` (2 vCPU, 7.5 GB RAM).
  - Alta Disponibilidad habilitada (HA Multi-Zona con failover automático).
  - Point-in-Time Recovery (PITR) y backups automatizados retenidos por 14 días.
  - Almacenamiento SSD: 50 GB con incremento automático habilitado.
- **Habilitación de Extensiones Espaciales:**
  - Conectar mediante Cloud SQL Auth Proxy con un usuario con rol de administración y ejecutar:
    ```sql
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS btree_gist;
    ```

#### 1.4 Configuración de Workload Identity Federation (WIF)
- Crear un Workload Identity Pool y un Provider OIDC enlazados al repositorio de GitHub Actions.
- Mapear atributos del token JWT de GitHub Actions (`assertion.repository` y `assertion.actor`).
- Crear la Service Account de despliegue con roles mínimos:
  - `roles/run.admin`
  - `roles/artifactregistry.writer`
  - `roles/iam.serviceAccountUser`
- Asignar la política de enlace IAM para que el repositorio de GitHub pueda suplantar la cuenta de servicio sin usar llaves JSON permanentes.

---

### Fase 2: Modelo de Datos Geoespacial y Persistencia

#### 2.1 Esquema DDL en PostGIS (WGS 84 - SRID 4326)
Definir las tablas principales con tipos espaciales nativos y soporte para coordinación distribuida:

```sql
-- 1. Catálogo principal de eventos sísmicos
CREATE TABLE seismic_events (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    place VARCHAR(255),
    time TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    magnitude NUMERIC(3, 1) NOT NULL,
    magnitude_type VARCHAR(10),
    depth NUMERIC(6, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AUTOMATIC',
    alert_level VARCHAR(10),
    significance INT,
    tsunami_alert BOOLEAN DEFAULT FALSE,
    geom GEOMETRY(Point, 4326) NOT NULL
);

-- 2. Reportes comunitarios de percepción
CREATE TABLE citizen_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(64) REFERENCES seismic_events(id) ON DELETE CASCADE,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    perceived_intensity SMALLINT NOT NULL CHECK (perceived_intensity BETWEEN 1 AND 5),
    emoji_tag VARCHAR(32),
    comment TEXT,
    geom GEOMETRY(Point, 4326) NOT NULL,
    client_fingerprint VARCHAR(64)
);

-- 3. Fallas geológicas activas y zonas de subducción
CREATE TABLE geological_faults (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    fault_type VARCHAR(50),
    country_code VARCHAR(3),
    geom GEOMETRY(MultiLineString, 4326) NOT NULL
);

-- 4. Coordinación distribuida de tareas programadas (ShedLock)
CREATE TABLE shedlock (
    name VARCHAR(64) PRIMARY KEY,
    lock_until TIMESTAMPTZ NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL,
    locked_by VARCHAR(255) NOT NULL
);
```

#### 2.2 Estrategia de Indexación Espaciotemporal
Optimizar los tiempos de respuesta para consultas concurrentes de alta carga, priorizando el filtrado por cobertura espacial seguido del temporal:
```sql
-- Índice espacial simple
CREATE INDEX idx_seismic_events_geom ON seismic_events USING GIST (geom);

-- Índice GiST compuesto optimizado (geometría primero para delimitar el viewport, luego tiempo)
CREATE INDEX idx_seismic_events_geom_time ON seismic_events USING GIST (geom, time);

CREATE INDEX idx_seismic_events_mag ON seismic_events (magnitude DESC);
CREATE INDEX idx_seismic_events_time ON seismic_events (time DESC);

CREATE INDEX idx_citizen_reports_event ON citizen_reports (event_id);
CREATE INDEX idx_citizen_reports_geom ON citizen_reports USING GIST (geom);

CREATE INDEX idx_geological_faults_geom ON geological_faults USING GIST (geom);
```

#### 2.3 Mapeo ORM en Spring Boot con Hibernate Spatial
- Configurar dependencias Maven/Gradle para `hibernate-spatial`, `jts-core` y `shedlock-spring` con `shedlock-provider-jdbc-template`.
- Mapear la entidad `SeismicEventEntity` asociando la columna `geom` al tipo `org.locationtech.jts.geom.Point`.
- Crear el repositorio `SeismicEventRepository` con consultas geoespaciales:
  - Búsqueda por Bounding Box mediante operador `&&` y `ST_MakeEnvelope`.
  - Búsqueda radial geodésica mediante `ST_DWithin(geom::geography, ..., radiusMeters)`.
  - Distancia a epicentro mediante `ST_Distance(geom::geography, ...) / 1000.0`.

---

### Fase 3: Microservicio de Ingesta Automática USGS (CDN + FDSN)

#### 3.1 Estrategia Dual de Consumo
1. **Feed CDN en Tiempo Real (Primario):**
   - URL: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson`
   - Ventajas: Generado estáticamente en CDN cada minuto, latencia ultrabaja, sin riesgo de rate-limiting de API.
   - Procesamiento: Filtrar en memoria por el bounding box de Centroamérica (Lat: 7.0° a 18.5°, Lon: -93.0° a -77.0°).
2. **Servicio FDSN Query (Secundario / Reconciliación Histórica):**
   - Endpoint: `/fdsnws/event/1/query` con `format=geojson` y parámetros de cuadrante regional.
   - Uso: Tarea de reconciliación periódica (cada 30 min) y arranque inicial para cargar el histórico de los últimos 30 días con parámetro `updatedafter`.

#### 3.2 Tarea Programada con Bloqueo Distribuido (ShedLock)
- Anotar el servicio con `@EnableScheduling` y `@EnableSchedulerLock(defaultLockAtMostFor = "PT2M")`.
- Implementar la ingesta periódica:
  ```java
  @Scheduled(fixedDelay = 60000) // Cada 60 segundos
  @SchedulerLock(name = "usgs_ingest_lock", lockAtLeastFor = "PT30S", lockAtMostFor = "PT1M")
  public void ingestEarthquakes() {
      // Ingesta segura: solo una réplica de Cloud Run ejecuta esta lógica
  }
  ```
- Mantener la marca de tiempo `lastSuccessfulCheck` con margen de seguridad temporal (Clock Skew) de 2 minutos para evitar omisiones por latencia de propagación de USGS.

#### 3.3 Lógica de Persistencia Idempotente (Upsert)
- Mapear el timestamp de USGS (epoch en milisegundos UTC) a `java.time.Instant`.
- Extraer coordenadas `[longitud, latitud, profundidad]`.
- Construir la geometría 2D `Point` con SRID 4326 usando `GeometryFactory` y almacenar la profundidad en kilómetros en la columna `depth`.
- Si el `id` ya existe: actualizar parámetros revisados (magnitud, profundidad, relocalización o cambio de estatus de `AUTOMATIC` a `REVIEWED`).
- Disparar el evento de publicación al bus distribuido únicamente si hay un sismo nuevo o cambios significativos de revisión técnica.

---

### Fase 4: Capa de Streaming Distribuido y API REST

#### 4.1 Endpoints REST del Backend y Caché HTTP
- `GET /api/v1/earthquakes`: Catálogo con filtros avanzados (fechas, magnitudes, profundidad y límites geográficos).
- `GET /api/v1/earthquakes/{id}`: Detalle de un sismo específico junto a métricas agregadas de percepción.
- `GET /api/v1/earthquakes/recent`: Últimos eventos registrados en las últimas 24 horas (usado por el frontend para hidratación inicial y post-reconexión).
- `GET /api/v1/faults`: Capa vectorial GeoJSON de fallas geológicas con cabecera `Cache-Control: public, max-age=86400, stale-while-revalidate=3600` y soporte de ETag para evitar consultas innecesarias a la BD.
- `POST /api/v1/earthquakes/{id}/reports`: Registro de reporte ciudadano de percepción con rate-limiting mediante Bucket4j.

#### 4.2 Broker en Tiempo Real con Bus Distribuido
Para asegurar que los clientes reciban las alertas sin importar a qué réplica de Cloud Run estén conectados:
1. **Publicación Interna:** Cuando la réplica que ejecuta la ingesta detecta un sismo nuevo/actualizado, publica el payload GeoJSON en un tema distribuido (**Google Cloud Pub/Sub** o canal Redis).
2. **Recepción Multi-Instancia:** Todas las réplicas activas de Cloud Run están suscritas al tema interno. Al recibir el evento, cada réplica lo reenvía a sus clientes WebSocket locales conectados a `/topic/earthquakes`.
3. **Configuración WebSocket en Spring:**
   - Endpoint: `/ws/seismic` con fallback SockJS y CORS restrictivo por entorno.
   - Heartbeats activos: Intervalos de Ping/Pong de 25 segundos para evitar que Cloud Run o proxies intermedios cierren la conexión por inactividad.

---

### Fase 5: Frontend en Angular (Signals) y Visualización Cartográfica WebGL

#### 5.1 Estructura del Proyecto Angular (PWA)
- Generar proyecto Angular 18+ con componentes Standalone.
- Configurar Service Worker (`@angular/pwa`) para almacenamiento en caché de iconos, hojas de estilo y tiles base.
- Adoptar **Angular Signals** y `ChangeDetectionStrategy.OnPush` para desacoplar el estado de los sismos de los ciclos globales de detección de cambios, garantizando 60 fps en el renderizado cartográfico.

#### 5.2 Integración de MapLibre GL JS y Tiles Abiertos
- Integrar la biblioteca mediante `ngx-maplibre-gl` / MapLibre GL JS nativo.
- Configurar estilos vectoriales con **CARTO Basemaps (Positron / Dark Matter)** o tiles abiertos de **OpenFreeMap** con conmutación dinámica de modo claro/oscuro.
- **Clustering Dinámico:** Agrupar sismos cercanos en círculos numéricos cuyo tamaño y color varíen según la cantidad y magnitud de eventos.
- **Capa de Mapa de Calor (Heatmap):** Capa interactiva ponderada por la magnitud (`mag`) y profundidad (`depth`), activable en vista macro.
- Superposición vectorial de fallas geológicas (`geological_faults`) con estilo estilizado de placa tectónica.

#### 5.3 Controles de Interacción Avanzada y Resiliencia
- **Línea de Tiempo Interactiva (Timeline Playback):**
  - Componente de barra temporal deslizante con control de reproducción (*Play/Pause*) y selector de velocidad (1x, 5x, 20x).
  - Animación secuencial de réplicas y enjambres sísmicos a lo largo del tiempo.
- **Suscripción Reactiva Resiliente:**
  - Servicio Angular con `@stomp/stompjs` configurado con reconexión automática mediante retroceso exponencial (*exponential backoff*).
  - En evento de reconexión exitosa, consultar automáticamente `GET /api/v1/earthquakes/recent` para fusionar cualquier sismo ocurrido durante la desconexión.
  - Notificación visual de pulso animado sobre el nuevo epicentro y sonido sutil opcional.
- **Panel de Filtros Rápidos:**
  - Deslizador reactivo de magnitud, selector de país (Guatemala, El Salvador, Honduras, Nicaragua, Costa Rica, Panamá) y filtro por profundidad.

---

### Fase 6: Módulo de Sismología Ciudadana ("¿Lo sentiste?")

#### 6.1 Experiencia de Usuario Ágil
- Inspirado en el modelo comunitario de EMSC LastQuake:
  - Eliminar cuestionarios largos.
  - Ofrecer una botonera táctil con 5 pictogramas/emojis de intensidad percibida (desde "No sentido / Muy leve" hasta "Pánico / Daños").
  - Geolocalización automática mediante la API del navegador con solicitud de permiso explícito.
  - Envío completado en menos de 3 toques en pantalla.

#### 6.2 Procesamiento Espacial y Validación de Plausibilidad
- **Validación Geodésica en Backend:**
  - Validar con PostGIS (`ST_DWithin(geom::geography, sismo_geom::geography, max_radius_meters)`) que el reporte esté dentro de un radio físicamente admisible según la magnitud (ej. Magnitud 3.5 $\to$ máx. 80 km; Magnitud 6.5 $\to$ máx. 500 km).
  - Descartar o etiquetar como sospechosos los reportes fuera del rango de percepción.
- **Protección Antispam:**
  - Rate limiting por IP/Fingerprint (máximo 1 reporte por sismo por cliente).
  - Ventana temporal estricta: solo se admiten reportes en las 2 horas posteriores al sismo.
- **Capa de Calor Comunitaria:**
  - Agrupamiento en PostGIS (`ST_SnapToGrid` y agregación de intensidad media) para pintar en el mapa las zonas con mayor intensidad sentida por la población.

---

### Fase 7: Automatización CI/CD con GitHub Actions

#### 7.1 Flujo de Trabajo (.github/workflows/deploy.yml)
- **Disparadores:** Push a `develop` (despliegue en Test) y Push a `main` (despliegue en Producción).
- **Pasos del Pipeline:**
  1. Checkout del código fuente.
  2. Autenticación con Google Cloud mediante `google-github-actions/auth` utilizando Workload Identity Federation (sin llaves JSON).
  3. Ejecución de pruebas unitarias y de integración (`mvn test`, `ng test --watch=false`).
  4. Construcción de imágenes Docker multi-stage optimizadas (Backend Spring Boot y Frontend Nginx/Angular).
  5. Publicación de imágenes en Google Artifact Registry.
  6. Despliegue en Google Cloud Run mediante `google-github-actions/deploy-cloudrun`:
     - **Configuración de Cloud Run:**
       - Asignación de CPU permanente: `--cpu-throttling=false` (para garantizar ejecución ininterrumpida de WebSockets e ingesta).
       - Timeout extendido: `--timeout=3600` (1 hora para conexiones WebSocket continuas).
       - Direct VPC Egress: `--network=default` y `--subnet=cloudrun-subnet` con enrutamiento interno a Cloud SQL.
       - Test: `--no-allow-unauthenticated` (acceso restringido vía IAM/IAP), `min-instances: 0`, `max-instances: 2`.
       - Producción: `--allow-unauthenticated`, `min-instances: 1`, `max-instances: 10`.

---

### Fase 8: Pruebas de Carga, Observabilidad y Criterios de Aceptación

#### 8.1 Pruebas y Validación Técnica
- **Prueba Multi-Instancia:** Levantar 2 o más instancias de Cloud Run y verificar que:
  - Solo una réplica ejecuta el polling de USGS gracias a ShedLock.
  - Clientes conectados a instancias diferentes reciben simultáneamente el mensaje WebSocket cuando entra un sismo nuevo.
- **Pruebas de Ingesta e Idempotencia:** Simular feeds GeoJSON repetidos y modificados de USGS y comprobar actualización limpia de estados `AUTOMATIC` a `REVIEWED`.
- **Pruebas Espaciales:** Ejecutar consultas de proximidad y Bounding Box con más de 50,000 registros sintéticos para verificar tiempos de respuesta inferiores a 50 ms con el índice `(geom, time)`.
- **Pruebas de Carga en Reportes:** Simular 1,000 envíos concurrentes de "¿Lo sentiste?" con JMeter/k6 y verificar tasa de éxito > 99.5% sin degradación en Cloud SQL.

#### 8.2 Observabilidad
- Configurar métricas y alertas en Google Cloud Monitoring:
  - Latencia p95 de endpoints REST y tiempos de consulta SQL.
  - Alerta inmediata si el candado de ShedLock no se renueva o si la ingesta de USGS falla por más de 5 minutos consecutivos.
  - Monitoreo de número de conexiones WebSocket activas por réplica.

#### 8.3 Criterios de Aceptación (Definition of Done)
1. Ingesta continua de USGS procesando eventos en menos de 60 segundos sin duplicaciones y con bloqueo distribuido verificado.
2. Base de datos PostGIS con extensiones `postgis` y `btree_gist` operando con índice compuesto `(geom, time)` de alta velocidad.
3. Notificaciones push vía WebSocket entregadas a navegadores en < 1 segundo desde la inserción del sismo, funcionando en entornos multi-instancia.
4. Mapa vectorial en Angular con MapLibre GL JS y tiles abiertos renderizando fluidamente a 60 fps con clustering, mapas de calor y control cronológico.
5. Sismología ciudadana con validación espacial de plausibilidad y agregación de calor comunitaria en vivo.
6. Pipeline de CI/CD automatizado en GitHub Actions con WIF, Direct VPC Egress y despliegue serverless robusto en Google Cloud Run.
