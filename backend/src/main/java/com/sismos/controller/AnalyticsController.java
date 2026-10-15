package com.sismos.controller;

import com.sismos.service.BigQueryAnalyticsService;
import com.sismos.service.PostGisAnalyticsService;
import com.sismos.model.dto.ClientErrorDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsController.class);

    private final PostGisAnalyticsService postGisAnalyticsService;
    private final Optional<BigQueryAnalyticsService> bigQueryAnalyticsService;

    public AnalyticsController(PostGisAnalyticsService postGisAnalyticsService,
                               Optional<BigQueryAnalyticsService> bigQueryAnalyticsService) {
        this.postGisAnalyticsService = postGisAnalyticsService;
        this.bigQueryAnalyticsService = bigQueryAnalyticsService;
    }

    @PostMapping("/client-errors")
    public ResponseEntity<Void> recordClientError(@RequestBody(required = false) ClientErrorDto clientError) {
        if (clientError != null && clientError.message() != null) {
            String shortStack = clientError.stack();
            if (shortStack != null && shortStack.length() > 600) {
                shortStack = shortStack.substring(0, 600) + "...";
            }
            log.warn("🚨 [FRONTEND CLIENT ERROR] Type: [{}], URL: [{}], Msg: [{}], Stack: [{}], UA: [{}]",
                    clientError.errorType() != null ? clientError.errorType() : "UnknownError",
                    clientError.url(),
                    clientError.message(),
                    shortStack,
                    clientError.userAgent());
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/regional-summary")
    public ResponseEntity<Map<String, Object>> getRegionalSummary(
            @RequestParam(name = "timeframe", defaultValue = "30d") String timeframe,
            @RequestParam(name = "fromYear", required = false) Integer fromYear,
            @RequestParam(name = "toYear", required = false) Integer toYear,
            @RequestParam(name = "country", required = false) String country) {

        int currentYear = java.time.Year.now().getValue();

        if (fromYear != null || toYear != null) {
            int startY = fromYear != null ? fromYear : 1980;
            int endY = toYear != null ? toYear : currentYear;
            if (startY < 1980 || startY > endY || endY > currentYear) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "status", "INVALID_TIMEFRAME",
                        "message", "Rango de años no válido. Debe estar entre 1980 y " + currentYear + " y fromYear <= toYear"
                ));
            }
            if (bigQueryAnalyticsService.isPresent()) {
                var bqResult = (country != null)
                        ? bigQueryAnalyticsService.get().getHistoricalRegionalSummary(startY, endY, country)
                        : bigQueryAnalyticsService.get().getHistoricalRegionalSummary(startY, endY);
                if (bqResult.isPresent()) {
                    return ResponseEntity.ok(bqResult.get());
                }
            }
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "status", "HISTORICAL_UNAVAILABLE",
                    "message", "El catálogo histórico en BigQuery no se encuentra disponible temporalmente"
            ));
        }

        if ("30d".equalsIgnoreCase(timeframe)) {
            return ResponseEntity.ok(postGisAnalyticsService.getRecentRegionalSummary());
        }

        if (!"40y".equalsIgnoreCase(timeframe) && !"historical".equalsIgnoreCase(timeframe)
                && !"5y".equalsIgnoreCase(timeframe) && !"10y".equalsIgnoreCase(timeframe)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "status", "INVALID_TIMEFRAME",
                    "message", "Parámetro timeframe no válido. Valores permitidos: 30d, 5y, 10y, 40y (o especificar fromYear y toYear)"
            ));
        }

        Integer rangeFrom = null;
        Integer rangeTo = null;

        if ("5y".equalsIgnoreCase(timeframe)) {
            rangeFrom = currentYear - 5;
            rangeTo = currentYear;
        } else if ("10y".equalsIgnoreCase(timeframe)) {
            rangeFrom = currentYear - 10;
            rangeTo = currentYear;
        }

        if (bigQueryAnalyticsService.isPresent()) {
            var bqResult = (country != null)
                    ? bigQueryAnalyticsService.get().getHistoricalRegionalSummary(rangeFrom, rangeTo, country)
                    : ((rangeFrom != null)
                        ? bigQueryAnalyticsService.get().getHistoricalRegionalSummary(rangeFrom, rangeTo)
                        : bigQueryAnalyticsService.get().getHistoricalRegionalSummary());
            if (bqResult.isPresent()) {
                return ResponseEntity.ok(bqResult.get());
            }
        }
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "status", "HISTORICAL_UNAVAILABLE",
                "message", "El catálogo histórico en BigQuery no se encuentra disponible temporalmente"
            ));
    }

    @GetMapping("/aftershock-forecast")
    public ResponseEntity<Map<String, Object>> getAftershockForecast() {
        return ResponseEntity.ok(postGisAnalyticsService.getAftershockForecast());
    }

    @GetMapping("/historical-insights")
    public ResponseEntity<Map<String, Object>> getHistoricalInsights(
            @RequestParam(name = "fromYear", required = false) Integer fromYear,
            @RequestParam(name = "toYear", required = false) Integer toYear,
            @RequestParam(name = "timeframe", required = false) String timeframe,
            @RequestParam(name = "country", required = false) String country) {

        int currentYear = java.time.Year.now().getValue();
        Integer rangeFrom = fromYear;
        Integer rangeTo = toYear;

        if (rangeFrom == null && rangeTo == null && timeframe != null) {
            if ("5y".equalsIgnoreCase(timeframe)) {
                rangeFrom = currentYear - 5;
                rangeTo = currentYear;
            } else if ("10y".equalsIgnoreCase(timeframe)) {
                rangeFrom = currentYear - 10;
                rangeTo = currentYear;
            }
        }

        if (bigQueryAnalyticsService.isPresent()) {
            Map<String, Integer> recentCountsM45 = postGisAnalyticsService.getRecentCountByCountryM45();
            var insights = (country != null)
                    ? bigQueryAnalyticsService.get().getHistoricalInsights(recentCountsM45, rangeFrom, rangeTo, country)
                    : ((rangeFrom != null || rangeTo != null)
                        ? bigQueryAnalyticsService.get().getHistoricalInsights(recentCountsM45, rangeFrom, rangeTo)
                        : bigQueryAnalyticsService.get().getHistoricalInsights(recentCountsM45));
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
