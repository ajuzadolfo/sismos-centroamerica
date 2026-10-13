-- 6. Fronteras administrativas de países de Centroamérica y fronteras (Natural Earth Admin 0)
CREATE TABLE country_boundaries (
    iso2 VARCHAR(2) PRIMARY KEY,
    name_es VARCHAR(100) NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX idx_country_boundaries_geom ON country_boundaries USING GIST (geom);
