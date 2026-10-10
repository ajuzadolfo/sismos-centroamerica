package com.sismos.controller;

import com.sismos.repository.GeologicalFaultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/faults")
@RequiredArgsConstructor
public class GeologicalFaultController {

    private final GeologicalFaultRepository geologicalFaultRepository;

    /**
     * Retorna la capa vectorial de fallas geológicas en formato GeoJSON con caché HTTP de 24 horas.
     */
    @GetMapping(produces = "application/geo+json")
    public ResponseEntity<String> getGeologicalFaults() {
        String geoJson = geologicalFaultRepository.findAllAsGeoJsonFeatureCollection();

        if (geoJson == null || geoJson.isBlank()) {
            geoJson = "{\"type\": \"FeatureCollection\", \"features\": []}";
        }

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(24, TimeUnit.HOURS).cachePublic().staleWhileRevalidate(1, TimeUnit.HOURS))
                .contentType(MediaType.parseMediaType("application/geo+json"))
                .body(geoJson);
    }
}
