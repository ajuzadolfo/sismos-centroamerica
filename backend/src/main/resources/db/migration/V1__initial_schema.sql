-- 1. Extensiones Espaciales y de Indexación
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Catálogo principal de eventos sísmicos
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

-- Índices geoespaciales y temporales
CREATE INDEX idx_seismic_events_geom ON seismic_events USING GIST (geom);
CREATE INDEX idx_seismic_events_geom_time ON seismic_events USING GIST (geom, time);
CREATE INDEX idx_seismic_events_mag ON seismic_events (magnitude DESC);
CREATE INDEX idx_seismic_events_time ON seismic_events (time DESC);

-- 3. Reportes comunitarios de percepción ("¿Lo sentiste?")
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

CREATE INDEX idx_citizen_reports_event ON citizen_reports (event_id);
CREATE INDEX idx_citizen_reports_geom ON citizen_reports USING GIST (geom);

-- 4. Fallas geológicas activas y zonas de subducción
CREATE TABLE geological_faults (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    fault_type VARCHAR(50),
    country_code VARCHAR(3),
    geom GEOMETRY(MultiLineString, 4326) NOT NULL
);

CREATE INDEX idx_geological_faults_geom ON geological_faults USING GIST (geom);

-- 5. Coordinación distribuida de tareas periódicas (ShedLock)
CREATE TABLE shedlock (
    name VARCHAR(64) PRIMARY KEY,
    lock_until TIMESTAMPTZ NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL,
    locked_by VARCHAR(255) NOT NULL
);
