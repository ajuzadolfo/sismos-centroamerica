package com.sismos.controller;

import com.sismos.model.dto.CitizenReportRequestDto;
import com.sismos.model.dto.CitizenReportResponseDto;
import com.sismos.model.dto.GeoJsonFeatureCollection;
import com.sismos.service.CitizenReportService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/earthquakes/{eventId}/reports")
@RequiredArgsConstructor
public class CitizenReportController {

    private final CitizenReportService citizenReportService;

    /**
     * Registro de reporte ciudadano de percepción ("¿Lo sentiste?") con validación geodésica.
     */
    @PostMapping
    public ResponseEntity<CitizenReportResponseDto> submitReport(
            @PathVariable String eventId,
            @Valid @RequestBody CitizenReportRequestDto requestDto,
            HttpServletRequest request
    ) {
        String clientIp = request.getHeader("X-Forwarded-For");
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = request.getRemoteAddr();
        } else if (clientIp.contains(",")) {
            clientIp = clientIp.split(",")[0].trim();
        }

        CitizenReportResponseDto response = citizenReportService.submitReport(eventId, requestDto, clientIp);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Agregaciones espaciales en cuadrícula (ST_SnapToGrid) para mapa de calor comunitario.
     */
    @GetMapping(value = "/clusters", produces = "application/geo+json")
    public ResponseEntity<GeoJsonFeatureCollection> getIntensityClusters(@PathVariable String eventId) {
        return ResponseEntity.ok(citizenReportService.getClustersAsGeoJson(eventId));
    }
}
