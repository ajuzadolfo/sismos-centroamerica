package com.sismos.controller;

import com.sismos.mapper.GeoJsonMapper;
import com.sismos.model.dto.EarthquakeDetailDto;
import com.sismos.model.dto.GeoJsonFeatureCollection;
import com.sismos.model.entity.SeismicEvent;
import com.sismos.repository.CitizenReportRepository;
import com.sismos.repository.SeismicEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@RestController
@RequestMapping("/api/v1/earthquakes")
@RequiredArgsConstructor
public class SeismicEventController {

    private final SeismicEventRepository seismicEventRepository;
    private final CitizenReportRepository citizenReportRepository;
    private final GeoJsonMapper geoJsonMapper;
    private final com.sismos.service.UsgsIngestionService usgsIngestionService;

    /**
     * Sincronización manual bajo demanda del catálogo histórico de la USGS.
     */
    @PostMapping("/sync")
    public ResponseEntity<java.util.Map<String, Object>> triggerSync(@RequestParam(defaultValue = "30") int days) {
        int synced = usgsIngestionService.syncHistoricalData(days);
        return ResponseEntity.ok(java.util.Map.of("synced", synced, "message", "Sincronizados " + synced + " sismos"));
    }

    /**
     * Catálogo con filtros avanzados: fecha, magnitud mínima y bounding box del mapa.
     */
    @GetMapping(produces = "application/geo+json")
    public ResponseEntity<GeoJsonFeatureCollection> getEarthquakes(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant since,
            @RequestParam(required = false, defaultValue = "0.0") BigDecimal minMagnitude,
            @RequestParam(required = false) Double minLat,
            @RequestParam(required = false) Double maxLat,
            @RequestParam(required = false) Double minLon,
            @RequestParam(required = false) Double maxLon
    ) {
        Instant effectiveSince = since != null ? since : Instant.now().minus(7, ChronoUnit.DAYS);
        List<SeismicEvent> events;

        if (minLat != null && maxLat != null && minLon != null && maxLon != null) {
            events = seismicEventRepository.findWithinBoundingBox(
                    minLon, minLat, maxLon, maxLat, effectiveSince, minMagnitude
            );
        } else {
            events = seismicEventRepository.findByTimeAfterOrderByTimeDesc(effectiveSince)
                    .stream()
                    .filter(e -> e.getMagnitude().compareTo(minMagnitude) >= 0)
                    .toList();
        }

        return ResponseEntity.ok(geoJsonMapper.toFeatureCollection(events));
    }

    /**
     * Sismos recientes (últimos 50) para hidratación inicial rápida de la interfaz.
     */
    @GetMapping(value = "/recent", produces = "application/geo+json")
    public ResponseEntity<GeoJsonFeatureCollection> getRecentEarthquakes() {
        List<SeismicEvent> events = seismicEventRepository.findTop50ByOrderByTimeDesc();
        return ResponseEntity.ok(geoJsonMapper.toFeatureCollection(events));
    }

    /**
     * Detalle específico de un sismo y agregación de reportes comunitarios.
     */
    @GetMapping("/{id}")
    public ResponseEntity<EarthquakeDetailDto> getEarthquakeDetail(@PathVariable String id) {
        return seismicEventRepository.findById(id)
                .map(event -> {
                    long reportCount = citizenReportRepository.countByEventId(id);
                    List<Object[]> clusters = citizenReportRepository.findIntensityClustersByEventId(id);

                    EarthquakeDetailDto detail = EarthquakeDetailDto.builder()
                            .id(event.getId())
                            .title(event.getTitle())
                            .place(event.getPlace())
                            .time(event.getTime())
                            .updatedAt(event.getUpdatedAt())
                            .magnitude(event.getMagnitude())
                            .magnitudeType(event.getMagnitudeType())
                            .depth(event.getDepth())
                            .status(event.getStatus())
                            .alertLevel(event.getAlertLevel())
                            .significance(event.getSignificance())
                            .tsunamiAlert(event.getTsunamiAlert())
                            .latitude(event.getLatitude())
                            .longitude(event.getLongitude())
                            .totalCitizenReports(reportCount)
                            .intensityClusters(clusters)
                            .build();

                    return ResponseEntity.ok(detail);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
