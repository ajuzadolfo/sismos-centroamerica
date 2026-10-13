package com.sismos.controller;

import com.sismos.model.entity.SeismicEvent;
import com.sismos.repository.SeismicEventRepository;
import com.sismos.service.BigQueryAnalyticsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AnalyticsController.class)
class AnalyticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SeismicEventRepository seismicEventRepository;

    @MockBean
    private BigQueryAnalyticsService bigQueryAnalyticsService;

    @Test
    @DisplayName("GET /api/v1/analytics/regional-summary con timeframe=30d debe retornar métricas de PostGIS")
    void shouldReturnRegionalSummaryFor30d() throws Exception {
        GeometryFactory factory = new GeometryFactory(new PrecisionModel(), 4326);
        Point point = factory.createPoint(new Coordinate(-86.2, 12.1));
        point.setSRID(4326);

        SeismicEvent event = SeismicEvent.builder()
                .id("us7000test")
                .title("M 5.5 - Managua, Nicaragua")
                .time(Instant.now())
                .updatedAt(Instant.now())
                .magnitude(BigDecimal.valueOf(5.5))
                .depth(BigDecimal.valueOf(25.0))
                .status("REVIEWED")
                .geom(point)
                .build();

        when(seismicEventRepository.findByTimeAfterOrderByTimeDesc(any())).thenReturn(List.of(event));

        mockMvc.perform(get("/api/v1/analytics/regional-summary?timeframe=30d"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataSource").value("POSTGIS"))
                .andExpect(jsonPath("$.timeframe").value("30d"))
                .andExpect(jsonPath("$.totalEventsAnalyzed").value(1))
                .andExpect(jsonPath("$.countryDistribution.Nicaragua").value(1))
                .andExpect(jsonPath("$.magnitudeDistribution.fuerte").value(1));
    }

    @Test
    @DisplayName("GET /api/v1/analytics/regional-summary con timeframe=40y retorna BIGQUERY si está disponible")
    void shouldReturnRegionalSummaryFor40yWhenBigQueryAvailable() throws Exception {
        Map<String, Object> mockSummary = Map.of(
                "dataSource", "BIGQUERY",
                "timeframe", "40y",
                "totalEventsAnalyzed", 44800,
                "windowStart", "1980-01-01 00:00:00",
                "windowEnd", "2026-10-12 18:00:00"
        );
        when(bigQueryAnalyticsService.getHistoricalRegionalSummary()).thenReturn(Optional.of(mockSummary));

        mockMvc.perform(get("/api/v1/analytics/regional-summary?timeframe=40y"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataSource").value("BIGQUERY"))
                .andExpect(jsonPath("$.timeframe").value("40y"))
                .andExpect(jsonPath("$.totalEventsAnalyzed").value(44800));
    }

    @Test
    @DisplayName("GET /api/v1/analytics/regional-summary con timeframe=40y retorna HTTP 503 si BigQuery falla")
    void shouldReturn503WhenHistoricalBigQueryFailsOrUnavailable() throws Exception {
        when(bigQueryAnalyticsService.getHistoricalRegionalSummary()).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/analytics/regional-summary?timeframe=40y"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("HISTORICAL_UNAVAILABLE"));
    }

    @Test
    @DisplayName("GET /api/v1/analytics/regional-summary con timeframe inválido retorna HTTP 400")
    void shouldReturn400ForInvalidTimeframe() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/regional-summary?timeframe=invalido"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value("INVALID_TIMEFRAME"));
    }

    @Test
    @DisplayName("GET /api/v1/analytics/aftershock-forecast debe retornar pronóstico de Reasenberg-Jones")
    void shouldReturnAftershockForecast() throws Exception {
        GeometryFactory factory = new GeometryFactory(new PrecisionModel(), 4326);
        Point point = factory.createPoint(new Coordinate(-80.5, 7.5));
        point.setSRID(4326);

        SeismicEvent event = SeismicEvent.builder()
                .id("us7000major")
                .title("M 7.2 - Costa Rica")
                .time(Instant.now().minusSeconds(3600 * 12))
                .updatedAt(Instant.now())
                .magnitude(BigDecimal.valueOf(7.2))
                .depth(BigDecimal.valueOf(15.0))
                .status("REVIEWED")
                .geom(point)
                .build();

        when(seismicEventRepository.findByTimeAfterOrderByTimeDesc(any())).thenReturn(List.of(event));

        mockMvc.perform(get("/api/v1/analytics/aftershock-forecast"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mainshockId").value("us7000major"))
                .andExpect(jsonPath("$.model").value("Reasenberg-Jones 1989 (parámetros genéricos)"))
                .andExpect(jsonPath("$.parameters.a").value(-1.67))
                .andExpect(jsonPath("$.forecastWindow24h.expectedCountM4").isNumber())
                .andExpect(jsonPath("$.forecastWindow24h.expectedCountM5").isNumber())
                .andExpect(jsonPath("$.forecastWindow24h.probabilityM5Plus").isString())
                .andExpect(jsonPath("$.disclaimer").isString());
    }
}
