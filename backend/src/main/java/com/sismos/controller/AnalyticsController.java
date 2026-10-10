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

    @GetMapping("/regional-summary")
    public ResponseEntity<Map<String, Object>> getRegionalSummary() {
        Instant since = Instant.now().minus(30, ChronoUnit.DAYS);
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
            double lat = e.getGeometry() != null ? e.getGeometry().getY() : 13.0;
            double lon = e.getGeometry() != null ? e.getGeometry().getX() : -88.0;
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
        response.put("totalEventsAnalyzed", events.size());
        response.put("analysisWindowDays", 30);
        response.put("countryDistribution", countryCounts);
        response.put("magnitudeDistribution", magBuckets);
        response.put("depthDistribution", Map.of(
                "shallowUnder30Km", someros,
                "intermediate30to70Km", intermedios,
                "deepOver70Km", profundos
        ));
        response.put("timestamp", Instant.now().toString());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/aftershock-forecast")
    public ResponseEntity<Map<String, Object>> getAftershockForecast() {
        // Buscar el evento mayor de los últimos 7 días
        Instant since = Instant.now().minus(7, ChronoUnit.DAYS);
        List<SeismicEvent> events = seismicEventRepository.findByTimeAfterOrderByTimeDesc(since);

        Optional<SeismicEvent> maxEvent = events.stream()
                .max(Comparator.comparing(SeismicEvent::getMagnitude));

        if (maxEvent.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "status", "NO_ACTIVE_MAJOR_EVENT",
                    "message", "No se registran eventos mayores recientes para modelado de réplicas"
            ));
        }

        SeismicEvent main = maxEvent.get();
        double mag = main.getMagnitude().doubleValue();
        long hoursElapsed = ChronoUnit.HOURS.between(main.getTime(), Instant.now());

        // Aplicación del modelo de decaimiento temporal de Omori: n(t) = K / (t + c)^p
        // Parámetros empíricos típicos para la Fosa Mesoamericana: K = 10^(0.85*M - 3.2), c = 0.05 días, p = 1.05
        double daysElapsed = Math.max(0.1, hoursElapsed / 24.0);
        double kFactor = Math.pow(10, 0.75 * mag - 2.8);
        double expectedRateNext24h = Math.max(0.2, kFactor / Math.pow(daysElapsed + 0.1, 1.05));
        double expectedRateNext48h = expectedRateNext24h * 1.8;
        double expectedRateNext72h = expectedRateNext24h * 2.4;

        double probM5Plus = Math.min(0.95, Math.max(0.05, 1.0 - Math.exp(-0.28 * expectedRateNext24h)));

        Map<String, Object> forecast = new LinkedHashMap<>();
        forecast.put("mainshockId", main.getId());
        forecast.put("mainshockTitle", main.getTitle());
        forecast.put("mainshockMagnitude", mag);
        forecast.put("hoursSinceMainshock", hoursElapsed);
        forecast.put("omoriParameters", Map.of("p", 1.05, "c", 0.05, "decayLaw", "Modified Omori Law"));
        forecast.put("forecastWindow24h", Map.of(
                "estimatedAftershockCount", Math.round(expectedRateNext24h * 10.0) / 10.0,
                "probabilityM5Plus", Math.round(probM5Plus * 100.0) + "%"
        ));
        forecast.put("forecastWindow48h", Map.of(
                "estimatedAftershockCount", Math.round(expectedRateNext48h * 10.0) / 10.0
        ));
        forecast.put("forecastWindow72h", Map.of(
                "estimatedAftershockCount", Math.round(expectedRateNext72h * 10.0) / 10.0
        ));

        return ResponseEntity.ok(forecast);
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
