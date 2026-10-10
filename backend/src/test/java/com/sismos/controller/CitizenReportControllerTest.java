package com.sismos.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sismos.model.dto.CitizenReportRequestDto;
import com.sismos.model.dto.CitizenReportResponseDto;
import com.sismos.model.dto.GeoJsonFeatureCollection;
import com.sismos.service.CitizenReportService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Collections;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CitizenReportController.class)
class CitizenReportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CitizenReportService citizenReportService;

    @Test
    @DisplayName("POST /reports debe retornar 201 Created cuando el reporte es válido")
    void shouldCreateReportWhenValid() throws Exception {
        CitizenReportRequestDto requestDto = CitizenReportRequestDto.builder()
                .perceivedIntensity((short) 3)
                .emojiTag("😨")
                .latitude(12.12)
                .longitude(-86.25)
                .clientFingerprint("device-abc-123")
                .build();

        CitizenReportResponseDto responseDto = CitizenReportResponseDto.builder()
                .id(UUID.randomUUID())
                .eventId("us7000test")
                .reportedAt(Instant.now())
                .perceivedIntensity((short) 3)
                .emojiTag("😨")
                .latitude(12.12)
                .longitude(-86.25)
                .distanceToEpicenterMeters(15420.0)
                .maxPerceptibleRadiusMeters(180000.0)
                .message("Reporte registrado con éxito")
                .build();

        when(citizenReportService.submitReport(eq("us7000test"), any(CitizenReportRequestDto.class), any()))
                .thenReturn(responseDto);

        mockMvc.perform(post("/api/v1/earthquakes/us7000test/reports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.eventId").value("us7000test"))
                .andExpect(jsonPath("$.perceivedIntensity").value(3))
                .andExpect(jsonPath("$.emojiTag").value("😨"))
                .andExpect(jsonPath("$.distanceToEpicenterMeters").value(15420.0));
    }

    @Test
    @DisplayName("POST /reports debe rechazar con 400 cuando está fuera del radio admisible")
    void shouldRejectWhenOutOfPerceptionRadius() throws Exception {
        CitizenReportRequestDto requestDto = CitizenReportRequestDto.builder()
                .perceivedIntensity((short) 5)
                .emojiTag("🏚️")
                .latitude(40.71) // Nueva York
                .longitude(-74.00)
                .clientFingerprint("device-abc-123")
                .build();

        when(citizenReportService.submitReport(eq("us7000test"), any(CitizenReportRequestDto.class), any()))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fuera del radio admisible"));

        mockMvc.perform(post("/api/v1/earthquakes/us7000test/reports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /clusters debe retornar FeatureCollection GeoJSON")
    void shouldReturnIntensityClustersGeoJson() throws Exception {
        GeoJsonFeatureCollection collection = GeoJsonFeatureCollection.builder()
                .type("FeatureCollection")
                .features(Collections.emptyList())
                .build();

        when(citizenReportService.getClustersAsGeoJson("us7000test")).thenReturn(collection);

        mockMvc.perform(get("/api/v1/earthquakes/us7000test/reports/clusters")
                        .accept("application/geo+json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("FeatureCollection"));
    }
}
