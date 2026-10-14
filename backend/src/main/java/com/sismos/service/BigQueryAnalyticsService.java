package com.sismos.service;

import com.google.cloud.bigquery.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
@Slf4j
public class BigQueryAnalyticsService {

    @Value("${spring.cloud.gcp.bigquery.enabled:true}")
    private boolean bigQueryEnabled;

    @Value("${spring.cloud.gcp.project-id:${PROJECT_ID:sismos-centroamerica-prod}}")
    private String projectId;

    private BigQuery bigquery;

    private final ExecutorService bqExecutor = Executors.newVirtualThreadPerTaskExecutor();

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

    @org.springframework.cache.annotation.Cacheable(value = "historicalSummary", key = "'summary_' + #fromYear + '_' + #toYear + '_' + (#countryCode != null ? #countryCode : 'all')", unless = "#result == null")
    public Optional<Map<String, Object>> getHistoricalRegionalSummary(Integer fromYear, Integer toYear, String countryCode) {
        if (!bigQueryEnabled) {
            return Optional.empty();
        }

        BigQuery client = getBigQueryClient();
        if (client == null) {
            return Optional.empty();
        }

        long startNs = System.nanoTime();

        int startY = (fromYear != null && fromYear >= 1980) ? fromYear : 1980;
        int currentY = java.time.Year.now().getValue();
        int endY = (toYear != null && toYear <= currentY) ? toYear : currentY;
        boolean hasYearFilter = (fromYear != null || toYear != null);

        String countryFilter = (countryCode != null && countryCode.matches("^[A-Za-z]{2}$"))
                ? String.format("AND country_code = '%s'", countryCode.toUpperCase(Locale.ROOT))
                : "";

        List<String> conditions = new ArrayList<>();
        if (hasYearFilter) {
            conditions.add(String.format(Locale.US, "event_time >= TIMESTAMP(DATE(%d, 1, 1)) AND event_time < TIMESTAMP(DATE(%d, 1, 1))", startY, endY + 1));
        }
        if (!countryFilter.isEmpty()) {
            conditions.add(String.format("country_code = '%s'", countryCode.toUpperCase(Locale.ROOT)));
        }

        String whereClause = conditions.isEmpty() ? "" : "WHERE " + String.join(" AND ", conditions);

        String query = String.format("""
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
              COUNTIF(country_code = 'EXT') AS ext_count,
              COUNTIF(country_code = 'OC' OR country_code IS NULL) AS oc_count,
              COUNTIF(magnitude < 3.5) AS mag_menor,
              COUNTIF(magnitude >= 3.5 AND magnitude < 4.5) AS mag_moderado,
              COUNTIF(magnitude >= 4.5 AND magnitude < 6.0) AS mag_fuerte,
              COUNTIF(magnitude >= 6.0) AS mag_mayor,
              COUNTIF(depth_km < 30) AS depth_shallow,
              COUNTIF(depth_km >= 30 AND depth_km <= 70) AS depth_intermediate,
              COUNTIF(depth_km > 70) AS depth_deep
            FROM `sismos_analytics.earthquake_catalog_latest`
            %s
            """, whereClause);

        try {
            QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(query)
                    .setUseQueryCache(true)
                    .setMaximumBytesBilled(100L * 1024L * 1024L) // 100 MB de salvaguarda
                    .build();
            TableResult result = client.query(queryConfig);

            Iterator<FieldValueList> iterator = result.iterateAll().iterator();
            if (!iterator.hasNext()) return Optional.empty();

            FieldValueList row = iterator.next();
            long total = row.get("total_events").getLongValue();
            if (total == 0) return Optional.empty();

            String minTime;
            if (!row.get("min_time").isNull()) {
                long sec = (long) (row.get("min_time").getTimestampValue() / 1_000_000L);
                minTime = java.time.Instant.ofEpochSecond(sec).toString();
            } else {
                minTime = startY + "-01-01T00:00:00Z";
            }
            String maxTime;
            if (!row.get("max_time").isNull()) {
                long sec = (long) (row.get("max_time").getTimestampValue() / 1_000_000L);
                maxTime = java.time.Instant.ofEpochSecond(sec).toString();
            } else {
                maxTime = endY + "-12-31T23:59:59Z";
            }

            Map<String, Integer> countryDistribution = new LinkedHashMap<>();
            countryDistribution.put("Guatemala", (int) row.get("gt_count").getLongValue());
            countryDistribution.put("El Salvador", (int) row.get("sv_count").getLongValue());
            countryDistribution.put("Honduras", (int) row.get("hn_count").getLongValue());
            countryDistribution.put("Nicaragua", (int) row.get("ni_count").getLongValue());
            countryDistribution.put("Costa Rica", (int) row.get("cr_count").getLongValue());
            countryDistribution.put("Panamá", (int) row.get("pa_count").getLongValue());
            countryDistribution.put("Fuera de Centroamérica", (int) row.get("ext_count").getLongValue());
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

            long queryLatencyMs = (System.nanoTime() - startNs) / 1_000_000L;

            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("dataSource", "BIGQUERY");
            summary.put("timeframe", hasFilter ? (startY + "-" + endY) : "40y");
            summary.put("fromYear", startY);
            summary.put("toYear", endY);
            summary.put("windowStart", minTime);
            summary.put("windowEnd", maxTime);
            summary.put("totalEventsAnalyzed", total);
            summary.put("countryDistribution", countryDistribution);
            summary.put("magnitudeDistribution", magDistribution);
            summary.put("depthDistribution", depthDistribution);
            summary.put("queryLatencyMs", queryLatencyMs);
            summary.put("timestamp", java.time.Instant.now().toString());

            return Optional.of(summary);
        } catch (Exception e) {
            log.warn("[BigQuery GIS] Error ejecutando consulta analítica histórica: {}", e.getMessage());
            return Optional.empty();
        }
    }

    public Optional<Map<String, Object>> getHistoricalRegionalSummary(Integer fromYear, Integer toYear) {
        return getHistoricalRegionalSummary(fromYear, toYear, null);
    }

    public Optional<Map<String, Object>> getHistoricalRegionalSummary() {
        return getHistoricalRegionalSummary(null, null, null);
    }

    private String mapCountryCode(String code) {
        return switch (code) {
            case "GT" -> "Guatemala";
            case "SV" -> "El Salvador";
            case "HN" -> "Honduras";
            case "NI" -> "Nicaragua";
            case "CR" -> "Costa Rica";
            case "PA" -> "Panamá";
            case "EXT" -> "Fuera de Centroamérica";
            default -> "Otros / Océano";
        };
    }

    @org.springframework.cache.annotation.Cacheable(value = "historicalInsights", key = "'insights_' + #fromYear + '_' + #toYear + '_' + (#countryCode != null ? #countryCode : 'all')", unless = "#result == null")
    public Optional<Map<String, Object>> getHistoricalInsights(Map<String, Integer> recentCountsM45, Integer fromYear, Integer toYear, String countryCode) {
        if (!bigQueryEnabled) {
            return Optional.empty();
        }

        BigQuery client = getBigQueryClient();
        if (client == null) {
            return Optional.empty();
        }

        long startNs = System.nanoTime();

        int startY = (fromYear != null && fromYear >= 1980) ? fromYear : 1980;
        int currentY = java.time.Year.now().getValue();
        int endY = (toYear != null && toYear <= currentY) ? toYear : currentY;
        boolean hasFilter = (fromYear != null || toYear != null);

        String timeFilter = hasFilter
                ? String.format(Locale.US, "AND event_time >= TIMESTAMP(DATE(%d, 1, 1)) AND event_time < TIMESTAMP(DATE(%d, 1, 1))", startY, endY + 1)
                : "";
        String whereTimeFilter = hasFilter
                ? String.format(Locale.US, "WHERE event_time >= TIMESTAMP(DATE(%d, 1, 1)) AND event_time < TIMESTAMP(DATE(%d, 1, 1))", startY, endY + 1)
                : "";

        String countryFilter = (countryCode != null && countryCode.matches("^[A-Za-z]{2}$"))
                ? String.format("AND country_code = '%s'", countryCode.toUpperCase(Locale.ROOT))
                : "";

        String combinedTimeFilter = timeFilter + " " + countryFilter;
        String combinedWhereFilter;
        if (whereTimeFilter.isEmpty()) {
            combinedWhereFilter = countryFilter.isEmpty() ? "" : "WHERE " + countryFilter.substring(4);
        } else {
            combinedWhereFilter = whereTimeFilter + " " + countryFilter;
        }

        try {
            // 1. Histograma de magnitud para encontrar Mc por máxima curvatura
            String histQuery = String.format("""
                SELECT 
                  ROUND(CAST(magnitude AS FLOAT64), 1) AS mag_bin,
                  COUNT(1) AS bin_count
                FROM `sismos_analytics.earthquake_catalog_latest`
                WHERE magnitude >= 2.0 AND magnitude <= 9.0 %s
                GROUP BY 1
                ORDER BY 1 ASC
                """, combinedTimeFilter);

            // 4. Top 10 sismos históricos (independiente de Mc, puede ejecutarse inmediatamente en paralelo)
            String top10Query = String.format("""
                SELECT 
                  event_id,
                  COALESCE(title, 'M ' || CAST(magnitude AS STRING)) AS title,
                  COALESCE(place, 'Centroamérica') AS place,
                  CAST(magnitude AS FLOAT64) AS magnitude,
                  COALESCE(magnitude_type, 'mw') AS magnitude_type,
                  CAST(depth_km AS FLOAT64) AS depth_km,
                  FORMAT_TIMESTAMP('%%Y-%%m-%%dT%%H:%%M:%%SZ', event_time) AS event_time,
                  latitude,
                  longitude
                FROM `sismos_analytics.earthquake_catalog_latest`
                %s
                ORDER BY magnitude DESC, event_time DESC
                LIMIT 10
                """, combinedWhereFilter);

            // 5. Comparativa de anomalía por país (M >= 4.5, calculada sobre la ventana temporal regional para no sesgar el baseline)
            String countryHistQuery = String.format("""
                SELECT 
                  COALESCE(country_code, 'OC') AS country_code,
                  COUNT(1) AS total_count
                FROM `sismos_analytics.earthquake_catalog_latest`
                WHERE CAST(magnitude AS FLOAT64) >= 4.5 %s
                GROUP BY 1
                """, timeFilter);

            // Etapa 1: Lanzar consultas independientes en paralelo (Virtual Threads)
            CompletableFuture<TableResult> top10Future = CompletableFuture.supplyAsync(() -> {
                try {
                    return client.query(QueryJobConfiguration.newBuilder(top10Query)
                            .setUseQueryCache(true)
                            .setMaximumBytesBilled(100L * 1024L * 1024L)
                            .build());
                } catch (Exception e) {
                    throw new RuntimeException("Top 10 query failed", e);
                }
            }, bqExecutor);

            CompletableFuture<TableResult> countryHistFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return client.query(QueryJobConfiguration.newBuilder(countryHistQuery)
                            .setUseQueryCache(true)
                            .setMaximumBytesBilled(100L * 1024L * 1024L)
                            .build());
                } catch (Exception e) {
                    throw new RuntimeException("Country histogram query failed", e);
                }
            }, bqExecutor);

            CompletableFuture<TableResult> histFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return client.query(QueryJobConfiguration.newBuilder(histQuery)
                            .setUseQueryCache(true)
                            .setMaximumBytesBilled(100L * 1024L * 1024L)
                            .build());
                } catch (Exception e) {
                    throw new RuntimeException("Magnitude histogram query failed", e);
                }
            }, bqExecutor);

            // Obtener resultado del histograma para calcular Mc
            TableResult histResult = histFuture.join();

            double maxBin = 4.3;
            long maxBinCount = 0;
            for (FieldValueList r : histResult.iterateAll()) {
                double bin = r.get("mag_bin").getDoubleValue();
                long count = r.get("bin_count").getLongValue();
                if (count > maxBinCount) {
                    maxBinCount = count;
                    maxBin = bin;
                }
            }
            double mc = Math.round((maxBin + 0.2) * 10.0) / 10.0;

            // Etapa 2: Lanzar consultas dependientes de Mc (Aki-Utsu MLE y Serie Anual) en paralelo
            String mleQuery = String.format(Locale.US, """
                SELECT 
                  COUNT(1) AS n_events,
                  AVG(CAST(magnitude AS FLOAT64)) AS mean_mag,
                  COALESCE(VAR_SAMP(CAST(magnitude AS FLOAT64)), 0.1) AS var_mag,
                  MIN(event_time) AS min_time,
                  MAX(event_time) AS max_time
                FROM `sismos_analytics.earthquake_catalog_latest`
                WHERE CAST(magnitude AS FLOAT64) >= %.1f %s
                """, mc, combinedTimeFilter);

            String yearlyQuery = String.format(Locale.US, """
                SELECT 
                  EXTRACT(YEAR FROM event_time) AS event_year,
                  COUNT(1) AS year_count
                FROM `sismos_analytics.earthquake_catalog_latest`
                WHERE CAST(magnitude AS FLOAT64) >= %.1f %s
                GROUP BY 1
                ORDER BY 1 ASC
                """, mc, combinedTimeFilter);

            CompletableFuture<TableResult> mleFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return client.query(QueryJobConfiguration.newBuilder(mleQuery)
                            .setUseQueryCache(true)
                            .setMaximumBytesBilled(100L * 1024L * 1024L)
                            .build());
                } catch (Exception e) {
                    throw new RuntimeException("Aki-Utsu MLE query failed", e);
                }
            }, bqExecutor);

            CompletableFuture<TableResult> yearlyFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return client.query(QueryJobConfiguration.newBuilder(yearlyQuery)
                            .setUseQueryCache(true)
                            .setMaximumBytesBilled(100L * 1024L * 1024L)
                            .build());
                } catch (Exception e) {
                    throw new RuntimeException("Yearly series query failed", e);
                }
            }, bqExecutor);

            // Sincronizar todas las consultas paralelas restantes
            CompletableFuture.allOf(top10Future, countryHistFuture, mleFuture, yearlyFuture).join();

            TableResult mleResult = mleFuture.join();
            TableResult yearlyResult = yearlyFuture.join();
            TableResult top10Result = top10Future.join();
            TableResult countryHistResult = countryHistFuture.join();

            // 2. Procesar Aki-Utsu MLE y error estándar
            double bValue = 0.95;
            double bStdErr = 0.03;
            long totalAboveMc = 0;
            double window30dCount = 480.0;

            var mleIterator = mleResult.iterateAll().iterator();
            if (mleIterator.hasNext()) {
                FieldValueList mleRow = mleIterator.next();
                totalAboveMc = mleRow.get("n_events").getLongValue();
                if (totalAboveMc > 10) {
                    double meanMag = mleRow.get("mean_mag").getDoubleValue();
                    double varMag = mleRow.get("var_mag").getDoubleValue();
                    double deltaM = 0.1;
                    double denominator = meanMag - (mc - deltaM / 2.0);
                    if (denominator > 0.05) {
                        bValue = (Math.log10(Math.E)) / denominator;
                        double sigmaMean = Math.sqrt(varMag / totalAboveMc);
                        bStdErr = 2.3 * bValue * bValue * sigmaMean;
                    }

                    if (!mleRow.get("min_time").isNull() && !mleRow.get("max_time").isNull()) {
                        long minSec = mleRow.get("min_time").getTimestampValue() / 1_000_000L;
                        long maxSec = mleRow.get("max_time").getTimestampValue() / 1_000_000L;
                        double totalDays = Math.max(30.0, (maxSec - minSec) / 86400.0);
                        window30dCount = totalDays / 30.0;
                    }
                }
            }
            bValue = Math.round(bValue * 100.0) / 100.0;
            bStdErr = Math.round(bStdErr * 100.0) / 100.0;

            // 3. Procesar Serie anual
            List<Map<String, Object>> yearlySeries = new ArrayList<>();
            for (FieldValueList yr : yearlyResult.iterateAll()) {
                yearlySeries.add(Map.of(
                        "year", yr.get("event_year").getLongValue(),
                        "count", yr.get("year_count").getLongValue()
                ));
            }

            // 4. Procesar Top 10 sismos históricos
            List<Map<String, Object>> top10List = new ArrayList<>();
            for (FieldValueList ev : top10Result.iterateAll()) {
                String id = ev.get("event_id").getStringValue();
                String eventTimeIso;
                try {
                    String raw = ev.get("event_time").getStringValue();
                    if (raw.contains("T") || raw.contains("-")) {
                        eventTimeIso = raw;
                    } else {
                        double sec = Double.parseDouble(raw);
                        eventTimeIso = java.time.Instant.ofEpochMilli((long) (sec * 1000)).toString();
                    }
                } catch (Exception e) {
                    eventTimeIso = ev.get("event_time").getStringValue();
                }

                top10List.add(Map.of(
                        "eventId", id,
                        "title", ev.get("title").getStringValue(),
                        "place", ev.get("place").getStringValue(),
                        "magnitude", Math.round(ev.get("magnitude").getDoubleValue() * 10.0) / 10.0,
                        "magnitudeType", ev.get("magnitude_type").getStringValue(),
                        "depthKm", Math.round(ev.get("depth_km").getDoubleValue() * 10.0) / 10.0,
                        "eventTime", eventTimeIso,
                        "latitude", ev.get("latitude").getDoubleValue(),
                        "longitude", ev.get("longitude").getDoubleValue(),
                        "usgsUrl", "https://earthquake.usgs.gov/earthquakes/eventpage/" + id
                ));
            }

            // 5. Comparativa de anomalía por país
            Map<String, Long> historicalTotals = new HashMap<>();
            for (FieldValueList row : countryHistResult.iterateAll()) {
                historicalTotals.put(row.get("country_code").getStringValue(), row.get("total_count").getLongValue());
            }

            List<Map<String, Object>> anomalyList = new ArrayList<>();
            Map<String, String> caCountries = new LinkedHashMap<>();
            caCountries.put("GT", "Guatemala");
            caCountries.put("SV", "El Salvador");
            caCountries.put("HN", "Honduras");
            caCountries.put("NI", "Nicaragua");
            caCountries.put("CR", "Costa Rica");
            caCountries.put("PA", "Panamá");

            for (var entry : caCountries.entrySet()) {
                String iso = entry.getKey();
                String name = entry.getValue();
                long histTotal = historicalTotals.getOrDefault(iso, 0L);
                double mean30d = Math.max(0.1, Math.round((histTotal / window30dCount) * 10.0) / 10.0);
                int count30d = recentCountsM45.getOrDefault(iso, 0);
                double ratio = Math.round((count30d / mean30d) * 10.0) / 10.0;

                String alert = "NEUTRAL";
                if (ratio >= 3.0) alert = "CRITICAL";
                else if (ratio >= 1.5) alert = "ELEVATED";

                anomalyList.add(Map.of(
                        "iso2", iso,
                        "country", name,
                        "count30d", count30d,
                        "historicalMean30d", mean30d,
                        "ratio", ratio,
                        "alertLevel", alert
                ));
            }

            long queryLatencyMs = (System.nanoTime() - startNs) / 1_000_000L;

            Map<String, Object> insights = new LinkedHashMap<>();
            insights.put("timeframe", hasFilter ? (startY + "-" + endY) : "40y");
            insights.put("fromYear", startY);
            insights.put("toYear", endY);
            insights.put("country", countryCode != null ? countryCode.toUpperCase(Locale.ROOT) : "ALL");
            insights.put("completenessMc", mc);
            insights.put("bValue", bValue);
            insights.put("bValueStdErr", bStdErr);
            insights.put("completenessNote", String.format(Locale.US, "Catálogo completo desde M≈%.1f · b = %.2f ± %.2f (Aki-Utsu / Shi-Bolt)", mc, bValue, bStdErr));
            insights.put("eventsAnalyzedAboveMc", totalAboveMc);
            insights.put("anomalyRatios", anomalyList);
            insights.put("yearlySeries", yearlySeries);
            insights.put("top10", top10List);
            insights.put("queryLatencyMs", queryLatencyMs);

            return Optional.of(insights);
        } catch (Exception e) {
            log.warn("[BigQuery GIS] Error generando insights históricos: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    public Optional<Map<String, Object>> getHistoricalInsights(Map<String, Integer> recentCountsM45, Integer fromYear, Integer toYear) {
        return getHistoricalInsights(recentCountsM45, fromYear, toYear, null);
    }

    public Optional<Map<String, Object>> getHistoricalInsights(Map<String, Integer> recentCountsM45) {
        return getHistoricalInsights(recentCountsM45, null, null, null);
    }
}

