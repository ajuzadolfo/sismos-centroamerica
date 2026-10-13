package com.sismos.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.InputStream;

@Slf4j
@Component
@RequiredArgsConstructor
public class CountryBoundarySeeder implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;
    private final ResourceLoader resourceLoader;
    private final ObjectMapper objectMapper;

    @Override
    public void run(ApplicationArguments args) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM country_boundaries",
                    Integer.class
            );

            if (count != null && count > 0) {
                log.info("Country boundaries already seeded (count: {}). Skipping.", count);
                return;
            }

            log.info("Seeding country boundaries from GeoJSON resource...");
            Resource resource = resourceLoader.getResource("classpath:geo/central_america_admin0.geojson");
            if (!resource.exists()) {
                log.warn("Resource geo/central_america_admin0.geojson not found.");
                return;
            }

            try (InputStream is = resource.getInputStream()) {
                JsonNode root = objectMapper.readTree(is);
                JsonNode features = root.path("features");

                if (!features.isArray()) {
                    log.warn("Invalid GeoJSON format: features array missing.");
                    return;
                }

                String insertSql = """
                    INSERT INTO country_boundaries (iso2, name_es, geom)
                    VALUES (?, ?, ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(?)), 4326))
                    ON CONFLICT (iso2) DO UPDATE SET
                        name_es = EXCLUDED.name_es,
                        geom = EXCLUDED.geom
                    """;

                int inserted = 0;
                for (JsonNode feature : features) {
                    JsonNode props = feature.path("properties");
                    String iso2 = props.hasNonNull("iso2")
                            ? props.path("iso2").asText()
                            : feature.path("id").asText();
                    String nameEs = props.path("name_es").asText(iso2);
                    String geomJson = objectMapper.writeValueAsString(feature.path("geometry"));

                    jdbcTemplate.update(insertSql, iso2, nameEs, geomJson);
                    inserted++;
                }

                log.info("Successfully seeded {} country boundaries.", inserted);
            }
        } catch (Exception e) {
            log.error("Failed to seed country boundaries: {}", e.getMessage(), e);
        }
    }
}
