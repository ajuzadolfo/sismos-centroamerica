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
        List<SeismicEvent> events = seismicEventRepository.findByTimeAfterOrderByTimeDesc(since);

        // 1. Distribución por países de Centroamérica (clasificación geográfica)
        Map<String, Integer> countryCounts = new LinkedHashMap<>();
        countryCounts.put("Guatemala", 0);
        countryCounts.put("El Salvador", 0);
        countryCounts.put("Honduras", 0);
        countryCounts.put("Nicaragua", 0);
        countryCounts.put("Costa Rica", 0);
        countryCounts.put("Panamá", 0);
        countryCounts.put("Otros / Océano", 0);

        // 2. Distribución por magnitud
        Map<String, Integer> magBuckets = new LinkedHashMap<>();
        magBuckets.put("menor", 0);     // < 3.5
        magBuckets.put("moderado", 0);  // 3.5 - 4.4
        magBuckets.put("fuerte", 0);    // 4.5 - 5.9
        magBuckets.put("mayor", 0);     // >= 6.0

        // 3. Distribución por profundidad
        int someros = 0;    // < 30 km
        int intermedios = 0;// 30 - 70 km
        int profundos = 0;  // > 70 km

        for (SeismicEvent e : events) {
            double lat = e.getLatitude() != null ? e.getLatitude() : 13.0;
            double lon = e.getLongitude() != null ? e.getLongitude() : -88.0;
            double mag = e.getMagnitude() != null ? e.getMagnitude().doubleValue() : 3.0;
            double depth = e.getDepth() != null ? e.getDepth().doubleValue() : 20.0;

            // Clasificación por país
            String country = classifyCountry(lat, lon);
            countryCounts.put(country, countryCounts.getOrDefault(country, 0) + 1);

            // Clasificación por magnitud
            if (mag >= 6.0) magBuckets.put("mayor", magBuckets.get("mayor") + 1);
            else if (mag >= 4.5) magBuckets.put("fuerte", magBuckets.get("fuerte") + 1);
            else if (mag >= 3.5) magBuckets.put("moderado", magBuckets.get("moderado") + 1);
            else magBuckets.put("menor", magBuckets.get("menor") + 1);

            // Clasificación por profundidad
            if (depth < 30) someros++;
            else if (depth <= 70) intermedios++;
            else profundos++;
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("dataSource", "POSTGIS");
        response.put("timeframe", "30d");
        response.put("windowStart", since.toString());
        response.put("windowEnd", now.toString());
        response.put("totalEventsAnalyzed", events.size());
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

    private String classifyCountry(double lat, double lon) {
        if (lon < -89.5 && lat >= 13.7) return "Guatemala";
        if (lon >= -90.2 && lon < -87.7 && lat >= 13.0 && lat <= 14.5) return "El Salvador";
        if (lon >= -89.0 && lon < -83.5 && lat > 13.5 && lat <= 16.5) return "Honduras";
        if (lon >= -87.8 && lon < -83.0 && lat >= 10.8 && lat <= 15.0) return "Nicaragua";
        if (lon >= -86.0 && lon < -82.5 && lat >= 8.0 && lat <= 11.2) return "Costa Rica";
        if (lon >= -83.1 && lon <= -77.0 && lat >= 7.0 && lat <= 9.8) return "Panamá";
        return "Otros / Océano";
    }
}
