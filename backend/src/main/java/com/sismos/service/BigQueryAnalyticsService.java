package com.sismos.service;

import com.google.cloud.bigquery.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@Slf4j
public class BigQueryAnalyticsService {

    @Value("${spring.cloud.gcp.bigquery.enabled:false}")
    private boolean bigQueryEnabled;

    @Value("${spring.cloud.gcp.project-id:${PROJECT_ID:sismos-centroamerica-prod}}")
    private String projectId;

    private BigQuery bigquery;

    public synchronized BigQuery getBigQueryClient() {
        if (bigquery == null && bigQueryEnabled) {
            try {
                this.bigquery = BigQueryOptions.newBuilder().setProjectId(projectId).build().getService();
                log.info("[BigQuery GIS] Cliente de BigQuery inicializado para proyecto: {}", projectId);
            } catch (Exception e) {
                log.warn("[BigQuery GIS] No se pudo inicializar el cliente BigQuery: {}", e.getMessage());
            }
        }
        return bigquery;
    }

    public boolean isEnabled() {
        return bigQueryEnabled;
    }

    public Optional<Map<String, Object>> getHistoricalRegionalSummary() {
        if (!bigQueryEnabled) {
            return Optional.empty();
        }

        BigQuery client = getBigQueryClient();
        if (client == null) {
            return Optional.empty();
        }

        String query = """
            SELECT
              country_code,
              COUNT(1) AS event_count,
              ROUND(AVG(magnitude), 2) AS avg_magnitude,
              MAX(magnitude) AS max_magnitude
            FROM `sismos_analytics.earthquake_catalog`
            GROUP BY country_code
            ORDER BY event_count DESC
            """;

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(query).build();
            TableResult result = client.query(queryConfig);

            Map<String, Integer> countryDistribution = new LinkedHashMap<>();
            long total = 0;

            for (FieldValueList row : result.iterateAll()) {
                String code = row.get("country_code").isNull() ? "OC" : row.get("country_code").getStringValue();
                String countryName = mapCountryCode(code);
                long count = row.get("event_count").getLongValue();
                countryDistribution.put(countryName, (int) count);
                total += count;
            }

            if (total == 0) return Optional.empty();

            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("dataSource", "BigQuery GIS (Catálogo Histórico 40+ Años)");
            summary.put("totalEventsAnalyzed", total);
            summary.put("countryDistribution", countryDistribution);
            return Optional.of(summary);
        } catch (Exception e) {
            log.warn("[BigQuery GIS] Error ejecutando consulta analítica histórica: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private String mapCountryCode(String code) {
        return switch (code) {
            case "GT" -> "Guatemala";
            case "SV" -> "El Salvador";
            case "HN" -> "Honduras";
            case "NI" -> "Nicaragua";
            case "CR" -> "Costa Rica";
            case "PA" -> "Panamá";
            default -> "Otros / Océano";
        };
    }
}
