package com.sismos.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sismos.model.dto.*;
import com.sismos.model.entity.CitizenReport;
import com.sismos.model.entity.SeismicEvent;
import com.sismos.repository.CitizenReportRepository;
import com.sismos.repository.SeismicEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CitizenReportService {

    private final CitizenReportRepository citizenReportRepository;
    private final SeismicEventRepository seismicEventRepository;
    private final WebSocketNotificationService webSocketNotificationService;
    private final ObjectMapper objectMapper;

    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    @Value("${sismos.reports.time-window-hours:72}")
    private int timeWindowHours;

    // Cache con desalojo automático por tiempo y capacidad máxima acotada para evitar fugas de memoria
    private final Cache<String, List<Long>> rateLimitCache = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofHours(1))
            .maximumSize(50_000)
            .build();

    private void enforceRateLimit(String fingerprint) {
        long now = System.currentTimeMillis();
        long windowStart = now - (60L * 60L * 1000L); // 1 hora
        rateLimitCache.asMap().compute(fingerprint, (k, timestamps) -> {
            if (timestamps == null) {
                timestamps = new ArrayList<>();
            }
            timestamps.removeIf(ts -> ts < windowStart);
            if (timestamps.size() >= 5) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Has alcanzado el límite máximo de reportes permitidos por hora (máximo 5). Por favor intenta más tarde.");
            }
            timestamps.add(now);
            return timestamps;
        });
    }

    /**
     * Calcula el radio máximo físicamente admisible de percepción humana en metros
     * en función de la magnitud del sismo.
     */
    public double calculateMaxPerceptionRadiusMeters(double magnitude) {
        if (magnitude <= 2.5) return 30_000.0;     // 30 km
        if (magnitude <= 3.5) return 80_000.0;     // 80 km
        if (magnitude <= 4.5) return 200_000.0;    // 200 km
        if (magnitude <= 5.5) return 350_000.0;    // 350 km
        if (magnitude <= 6.5) return 600_000.0;    // 600 km
        if (magnitude <= 7.5) return 950_000.0;    // 950 km
        return 1_500_000.0;                        // 1,500 km para megaterremotos
    }

    /**
     * Valida espacialmente y persiste un reporte ciudadano de percepción ("¿Lo sentiste?").
     */
    @Transactional
    public CitizenReportResponseDto submitReport(String eventId, CitizenReportRequestDto request, String clientIp) {
        SeismicEvent event = seismicEventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sismo no encontrado con ID: " + eventId));

        // 1. Identificación y Protección Antispam / Rate-limiting
        String fingerprint = (request.getClientFingerprint() != null && !request.getClientFingerprint().isBlank())
                ? request.getClientFingerprint().trim()
                : (clientIp != null ? clientIp.trim() : "anonymous-client");

        enforceRateLimit(fingerprint);

        if (citizenReportRepository.existsByEventIdAndClientFingerprint(eventId, fingerprint)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya se ha registrado previamente un reporte de percepción desde este dispositivo para este sismo.");
        }

        // 2. Validación de Ventana Temporal
        Instant reportCutoff = event.getTime().plus(timeWindowHours, ChronoUnit.HOURS);
        if (Instant.now().isAfter(reportCutoff)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("La ventana temporal para reportar este sismo ha expirado (límite de %d horas posteriores al evento).", timeWindowHours));
        }

        // 3. Validación Geodésica de Plausibilidad Espacial (PostGIS ST_Distance)
        Double distanceMeters = seismicEventRepository.calculateDistanceToEpicenter(eventId, request.getLongitude(), request.getLatitude());
        if (distanceMeters == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error al calcular distancia geodésica al epicentro.");
        }

        double maxRadiusMeters = calculateMaxPerceptionRadiusMeters(event.getMagnitude().doubleValue());
        if (distanceMeters > maxRadiusMeters) {
            log.warn("Reporte descartado por plausibilidad espacial: distancia={} m, radioMax={} m, mag={}, eventId={}",
                    distanceMeters, maxRadiusMeters, event.getMagnitude(), eventId);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("La ubicación reportada está a %.1f km del epicentro, lo cual excede el radio máximo admisible de percepción (%.0f km) para un sismo magnitud %.1f.",
                            distanceMeters / 1000.0, maxRadiusMeters / 1000.0, event.getMagnitude()));
        }

        // 4. Construcción de Geometría PostGIS (Point SRID 4326)
        Point geom = geometryFactory.createPoint(new Coordinate(request.getLongitude(), request.getLatitude()));
        geom.setSRID(4326);

        CitizenReport report = CitizenReport.builder()
                .eventId(eventId)
                .reportedAt(Instant.now())
                .perceivedIntensity(request.getPerceivedIntensity())
                .emojiTag(request.getEmojiTag())
                .comment(request.getComment())
                .geom(geom)
                .clientFingerprint(fingerprint)
                .build();

        CitizenReport saved = citizenReportRepository.save(report);

        // 5. Difusión en Tiempo Real vía WebSocket
        long totalReports = citizenReportRepository.countByEventId(eventId);
        List<Object[]> clusters = citizenReportRepository.findIntensityClustersByEventId(eventId);
        Double avgIntensity = calculateOverallAverage(clusters);
        webSocketNotificationService.notifyCitizenReport(eventId, totalReports, avgIntensity);

        log.info("Reporte ciudadano guardado con exito para sismo {} [Intensidad: {}, Distancia: {} km]",
                eventId, request.getPerceivedIntensity(), Math.round(distanceMeters / 1000.0));

        return CitizenReportResponseDto.builder()
                .id(saved.getId())
                .eventId(eventId)
                .reportedAt(saved.getReportedAt())
                .perceivedIntensity(saved.getPerceivedIntensity())
                .emojiTag(saved.getEmojiTag())
                .latitude(saved.getLatitude())
                .longitude(saved.getLongitude())
                .distanceToEpicenterMeters(distanceMeters)
                .maxPerceptibleRadiusMeters(maxRadiusMeters)
                .message("Reporte de percepción registrado y validado geoespacialmente con éxito.")
                .build();
    }

    /**
     * Retorna los agregados de intensidad comunitaria agrupados por cuadrícula espacial (ST_SnapToGrid)
     * en formato GeoJSON FeatureCollection para visualización en MapLibre GL.
     */
    @Transactional(readOnly = true)
    public GeoJsonFeatureCollection getClustersAsGeoJson(String eventId) {
        List<Object[]> rawClusters = citizenReportRepository.findIntensityClustersByEventId(eventId);
        List<GeoJsonFeature> features = new ArrayList<>();

        for (Object[] row : rawClusters) {
            try {
                String geoJsonStr = (String) row[0];
                Number avgIntensityNum = (Number) row[1];
                Number reportCountNum = (Number) row[2];

                GeoJsonGeometry geometry = objectMapper.readValue(geoJsonStr, GeoJsonGeometry.class);

                Map<String, Object> properties = Map.of(
                        "averageIntensity", avgIntensityNum != null ? avgIntensityNum.doubleValue() : 1.0,
                        "reportCount", reportCountNum != null ? reportCountNum.longValue() : 1L
                );

                features.add(GeoJsonFeature.builder()
                        .type("Feature")
                        .geometry(geometry)
                        .properties(properties)
                        .build());
            } catch (Exception e) {
                log.error("Error al serializar cluster de reporte ciudadano: {}", e.getMessage(), e);
            }
        }

        return GeoJsonFeatureCollection.builder()
                .type("FeatureCollection")
                .features(features)
                .build();
    }

    private Double calculateOverallAverage(List<Object[]> clusters) {
        if (clusters == null || clusters.isEmpty()) return null;
        double totalWeightedIntensity = 0;
        long totalReports = 0;

        for (Object[] row : clusters) {
            Number avg = (Number) row[1];
            Number count = (Number) row[2];
            if (avg != null && count != null) {
                totalWeightedIntensity += avg.doubleValue() * count.longValue();
                totalReports += count.longValue();
            }
        }

        return totalReports > 0 ? Math.round((totalWeightedIntensity / totalReports) * 100.0) / 100.0 : null;
    }
}
