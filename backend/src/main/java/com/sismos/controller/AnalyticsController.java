package com.sismos.controller;

import com.sismos.service.BigQueryAnalyticsService;
import com.sismos.service.PostGisAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final PostGisAnalyticsService postGisAnalyticsService;
    private final Optional<BigQueryAnalyticsService> bigQueryAnalyticsService;

    @GetMapping("/regional-summary")
    public ResponseEntity<Map<String, Object>> getRegionalSummary(
            @RequestParam(name = "timeframe", defaultValue = "30d") String timeframe) {
        if (!"30d".equalsIgnoreCase(timeframe) && !"40y".equalsIgnoreCase(timeframe) && !"historical".equalsIgnoreCase(timeframe)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "status", "INVALID_TIMEFRAME",
                    "message", "Parámetro timeframe no válido. Valores permitidos: 30d, 40y"
            ));
        }

        if ("40y".equalsIgnoreCase(timeframe) || "historical".equalsIgnoreCase(timeframe)) {
            if (bigQueryAnalyticsService.isPresent()) {
                var bqResult = bigQueryAnalyticsService.get().getHistoricalRegionalSummary();
                if (bqResult.isPresent()) {
                    return ResponseEntity.ok(bqResult.get());
                }
            }
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "status", "HISTORICAL_UNAVAILABLE",
                    "message", "El catálogo histórico en BigQuery no se encuentra disponible temporalmente"
            ));
        }

        return ResponseEntity.ok(postGisAnalyticsService.getRecentRegionalSummary());
    }

    @GetMapping("/aftershock-forecast")
    public ResponseEntity<Map<String, Object>> getAftershockForecast() {
        return ResponseEntity.ok(postGisAnalyticsService.getAftershockForecast());
    }

    @GetMapping("/historical-insights")
    public ResponseEntity<Map<String, Object>> getHistoricalInsights() {
        if (bigQueryAnalyticsService.isPresent()) {
            Map<String, Integer> recentCountsM45 = postGisAnalyticsService.getRecentCountByCountryM45();
            var insights = bigQueryAnalyticsService.get().getHistoricalInsights(recentCountsM45);
            if (insights.isPresent()) {
                return ResponseEntity.ok(insights.get());
            }
        }
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "status", "HISTORICAL_UNAVAILABLE",
                "message", "Los insights analíticos del catálogo histórico en BigQuery no se encuentran disponibles temporalmente"
        ));
    }
}
