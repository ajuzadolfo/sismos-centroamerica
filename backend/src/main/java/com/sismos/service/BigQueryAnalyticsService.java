package com.sismos.service;

import com.google.cloud.bigquery.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@Slf4j
public class BigQueryAnalyticsService {

    @Value("${spring.cloud.gcp.bigquery.enabled:true}")
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
              COUNT(1) AS total_events,
              MIN(event_time) AS min_time,
              MAX(event_time) AS max_time,
              COUNTIF(country_code = 'GT') AS gt_count,
              COUNTIF(country_code = 'SV') AS sv_count,
              COUNTIF(country_code = 'HN') AS hn_count,
              COUNTIF(country_code = 'NI') AS ni_count,
              COUNTIF(country_code = 'CR') AS cr_count,
              COUNTIF(country_code = 'PA') AS pa_count,
              COUNTIF(country_code = 'OC' OR country_code IS NULL) AS oc_count,
              COUNTIF(magnitude < 3.5) AS mag_menor,
              COUNTIF(magnitude >= 3.5 AND magnitude < 4.5) AS mag_moderado,
              COUNTIF(magnitude >= 4.5 AND magnitude < 6.0) AS mag_fuerte,
              COUNTIF(magnitude >= 6.0) AS mag_mayor,
              COUNTIF(depth_km < 30) AS depth_shallow,
              COUNTIF(depth_km >= 30 AND depth_km <= 70) AS depth_intermediate,
              COUNTIF(depth_km > 70) AS depth_deep
            FROM `sismos_analytics.earthquake_catalog_latest`
            """;

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(query).build();
            TableResult result = client.query(queryConfig);

            Iterator<FieldValueList> iterator = result.iterateAll().iterator();
            if (!iterator.hasNext()) return Optional.empty();

            FieldValueList row = iterator.next();
            long total = row.get("total_events").getLongValue();
            if (total == 0) return Optional.empty();

            String minTime = !row.get("min_time").isNull() ? row.get("min_time").getStringValue() : "1980-01-01T00:00:00Z";
            String maxTime = !row.get("max_time").isNull() ? row.get("max_time").getStringValue() : java.time.Instant.now().toString();

            Map<String, Integer> countryDistribution = new LinkedHashMap<>();
            countryDistribution.put("Guatemala", (int) row.get("gt_count").getLongValue());
            countryDistribution.put("El Salvador", (int) row.get("sv_count").getLongValue());
            countryDistribution.put("Honduras", (int) row.get("hn_count").getLongValue());
            countryDistribution.put("Nicaragua", (int) row.get("ni_count").getLongValue());
            countryDistribution.put("Costa Rica", (int) row.get("cr_count").getLongValue());
            countryDistribution.put("Panamá", (int) row.get("pa_count").getLongValue());
            countryDistribution.put("Otros / Océano", (int) row.get("oc_count").getLongValue());

            Map<String, Integer> magDistribution = new LinkedHashMap<>();
            magDistribution.put("menor", (int) row.get("mag_menor").getLongValue());
            magDistribution.put("moderado", (int) row.get("mag_moderado").getLongValue());
            magDistribution.put("fuerte", (int) row.get("mag_fuerte").getLongValue());
            magDistribution.put("mayor", (int) row.get("mag_mayor").getLongValue());

            Map<String, Integer> depthDistribution = new LinkedHashMap<>();
            depthDistribution.put("shallowUnder30Km", (int) row.get("depth_shallow").getLongValue());
            depthDistribution.put("intermediate30to70Km", (int) row.get("depth_intermediate").getLongValue());
            depthDistribution.put("deepOver70Km", (int) row.get("depth_deep").getLongValue());

            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("dataSource", "BIGQUERY");
            summary.put("timeframe", "40y");
            summary.put("windowStart", minTime);
            summary.put("windowEnd", maxTime);
            summary.put("totalEventsAnalyzed", total);
            summary.put("countryDistribution", countryDistribution);
            summary.put("magnitudeDistribution", magDistribution);
            summary.put("depthDistribution", depthDistribution);
            summary.put("timestamp", java.time.Instant.now().toString());

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
