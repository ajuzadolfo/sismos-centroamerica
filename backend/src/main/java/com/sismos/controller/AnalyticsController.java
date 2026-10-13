package com.sismos.controller;

import com.sismos.model.entity.SeismicEvent;
import com.sismos.repository.SeismicEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final SeismicEventRepository seismicEventRepository;
    private final java.util.Optional<com.sismos.service.BigQueryAnalyticsService> bigQueryAnalyticsService;

    @GetMapping("/regional-summary")
    public ResponseEntity<Map<String, Object>> getRegionalSummary(
            @org.springframework.web.bind.annotation.RequestParam(name = "timeframe", defaultValue = "30d") String timeframe) {
        if (!"30d".equalsIgnoreCase(timeframe) && !"40y".equalsIgnoreCase(timeframe) && !"historical".equalsIgnoreCase(timeframe)) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_REQUEST).body(Map.of(
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
            return ResponseEntity.status(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "status", "HISTORICAL_UNAVAILABLE",
                    "message", "El catálogo histórico en BigQuery no se encuentra disponible temporalmente"
            ));
        }

        Instant now = Instant.now();
        Instant since = now.minus(30, ChronoUnit.DAYS);
        List<com.sismos.repository.projection.RegionalSummaryRow> rows = seismicEventRepository.getRegionalSummaryAggregation(since);

        // 1. Distribución por países (clasificación espacial oficial PostGIS)
        Map<String, Integer> countryCounts = new LinkedHashMap<>();
        countryCounts.put("Guatemala", 0);
        countryCounts.put("El Salvador", 0);
        countryCounts.put("Honduras", 0);
        countryCounts.put("Nicaragua", 0);
        countryCounts.put("Costa Rica", 0);
        countryCounts.put("Panamá", 0);
        countryCounts.put("Fuera de Centroamérica", 0);
        countryCounts.put("Otros / Océano", 0);

        int totalEvents = 0;
        int magMenor = 0;
        int magModerado = 0;
        int magFuerte = 0;
        int magMayor = 0;
        int someros = 0;
        int intermedios = 0;
        int profundos = 0;

        for (var row : rows) {
            String label = row.getCountryLabel();
            int count = row.getTotalCount() != null ? row.getTotalCount().intValue() : 0;
            countryCounts.put(label, countryCounts.getOrDefault(label, 0) + count);
            totalEvents += count;
            magMenor += row.getMagMenor() != null ? row.getMagMenor().intValue() : 0;
            magModerado += row.getMagModerado() != null ? row.getMagModerado().intValue() : 0;
            magFuerte += row.getMagFuerte() != null ? row.getMagFuerte().intValue() : 0;
            magMayor += row.getMagMayor() != null ? row.getMagMayor().intValue() : 0;
            someros += row.getSomeros() != null ? row.getSomeros().intValue() : 0;
            intermedios += row.getIntermedios() != null ? row.getIntermedios().intValue() : 0;
            profundos += row.getProfundos() != null ? row.getProfundos().intValue() : 0;
        }

        // 2. Distribución por magnitud
        Map<String, Integer> magBuckets = new LinkedHashMap<>();
        magBuckets.put("menor", magMenor);
        magBuckets.put("moderado", magModerado);
        magBuckets.put("fuerte", magFuerte);
        magBuckets.put("mayor", magMayor);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("dataSource", "POSTGIS");
        response.put("timeframe", "30d");
        response.put("windowStart", since.toString());
        response.put("windowEnd", now.toString());
        response.put("totalEventsAnalyzed", totalEvents);
        response.put("countryDistribution", countryCounts);
        response.put("magnitudeDistribution", magBuckets);
        response.put("depthDistribution", Map.of(
                "shallowUnder30Km", someros,
                "intermediate30to70Km", intermedios,
                "deepOver70Km", profundos
        ));
        response.put("timestamp", now.toString());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/aftershock-forecast")
    public ResponseEntity<Map<String, Object>> getAftershockForecast() {
        // Buscar el evento mayor de los últimos 30 días con M >= 6.0
        Instant since = Instant.now().minus(30, ChronoUnit.DAYS);
        List<SeismicEvent> events = seismicEventRepository.findByTimeAfterOrderByTimeDesc(since);

        Optional<SeismicEvent> maxEvent = events.stream()
                .filter(e -> e.getMagnitude() != null && e.getMagnitude().doubleValue() >= 6.0)
                .max(Comparator.comparing(SeismicEvent::getMagnitude));

        if (maxEvent.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "status", "NO_ACTIVE_MAJOR_EVENT",
                    "message", "No se registran eventos mayores recientes (M >= 6.0) para modelado de réplicas"
            ));
        }

        SeismicEvent main = maxEvent.get();
        double mag = main.getMagnitude().doubleValue();
        long minutesElapsed = Math.max(1, ChronoUnit.MINUTES.between(main.getTime(), Instant.now()));
        double t0 = minutesElapsed / 1440.0; // tiempo en días transcurridos

        Map<String, Object> forecast = new LinkedHashMap<>();
        forecast.put("mainshockId", main.getId());
        forecast.put("mainshockTitle", main.getTitle());
        forecast.put("mainshockMagnitude", mag);
        forecast.put("hoursSinceMainshock", ChronoUnit.HOURS.between(main.getTime(), Instant.now()));
        forecast.put("model", "Reasenberg-Jones 1989 (parámetros genéricos)");
        forecast.put("parameters", Map.of(
                "a", com.sismos.analytics.ReasenbergJonesForecaster.PARAM_A,
                "b", com.sismos.analytics.ReasenbergJonesForecaster.PARAM_B,
                "p", com.sismos.analytics.ReasenbergJonesForecaster.PARAM_P,
                "c", com.sismos.analytics.ReasenbergJonesForecaster.PARAM_C
        ));
        forecast.put("disclaimer", "Modelo estadístico genérico. No es un pronóstico oficial; consulte a su agencia sismológica nacional.");
        forecast.put("forecastWindow24h", buildWindowForecast(mag, t0, 1.0));
        forecast.put("forecastWindow48h", buildWindowForecast(mag, t0, 2.0));
        forecast.put("forecastWindow72h", buildWindowForecast(mag, t0, 3.0));

        return ResponseEntity.ok(forecast);
    }

    private Map<String, Object> buildWindowForecast(double mainMag, double t0, double windowDays) {
        double n4 = com.sismos.analytics.ReasenbergJonesForecaster.expectedCount(mainMag, 4.0, t0, t0 + windowDays);
        double n5 = com.sismos.analytics.ReasenbergJonesForecaster.expectedCount(mainMag, 5.0, t0, t0 + windowDays);
        double n6 = com.sismos.analytics.ReasenbergJonesForecaster.expectedCount(mainMag, 6.0, t0, t0 + windowDays);
        double nMain = com.sismos.analytics.ReasenbergJonesForecaster.expectedCount(mainMag, mainMag, t0, t0 + windowDays);

        double p5 = com.sismos.analytics.ReasenbergJonesForecaster.probabilityAtLeastOne(n5);
        double p6 = com.sismos.analytics.ReasenbergJonesForecaster.probabilityAtLeastOne(n6);
        double pMain = com.sismos.analytics.ReasenbergJonesForecaster.probabilityAtLeastOne(nMain);

        Map<String, Object> win = new LinkedHashMap<>();
        win.put("windowHours", (int) (windowDays * 24));
        win.put("estimatedAftershockCount", Math.round(n4 * 10.0) / 10.0);
        win.put("expectedCountM4", Math.round(n4 * 10.0) / 10.0);
        win.put("expectedCountM5", Math.round(n5 * 10.0) / 10.0);
        win.put("probabilityM5Plus", formatProbability(p5));
        win.put("probabilityM6Plus", formatProbability(p6));
        win.put("probabilityMainMagPlus", formatProbability(pMain));
        return win;
    }

    private String formatProbability(double p) {
        if (p >= 0.995) return ">99%";
        if (p <= 0.005) return "<1%";
        return Math.round(p * 100.0) + "%";
    }
}
