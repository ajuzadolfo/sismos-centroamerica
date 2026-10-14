package com.sismos.controller;

import com.sismos.service.BigQueryAnalyticsService;
import com.sismos.service.PostGisAnalyticsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AnalyticsController.class)
class AnalyticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PostGisAnalyticsService postGisAnalyticsService;

    @MockBean
    private BigQueryAnalyticsService bigQueryAnalyticsService;

    @Test
    @DisplayName("GET /api/v1/analytics/regional-summary con timeframe=30d debe retornar métricas de PostGIS")
    void shouldReturnRegionalSummaryFor30d() throws Exception {
        Map<String, Object> mockSummary = Map.of(
                "dataSource", "POSTGIS",
                "timeframe", "30d",
                "totalEventsAnalyzed", 1,
                "countryDistribution", Map.of("Nicaragua", 1),
                "magnitudeDistribution", Map.of("fuerte", 1),
                "queryLatencyMs", 12L
        );

        when(postGisAnalyticsService.getRecentRegionalSummary()).thenReturn(mockSummary);

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
                "windowEnd", "2026-10-12 18:00:00",
                "queryLatencyMs", 850L
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
        Map<String, Object> mockForecast = Map.of(
                "mainshockId", "us7000major",
                "model", "Reasenberg-Jones 1989 (parámetros genéricos)",
                "parameters", Map.of("a", -1.67),
                "forecastWindow24h", Map.of(
                        "expectedCountM4", 15.2,
                        "expectedCountM5", 2.1,
                        "probabilityM5Plus", "88%"
                ),
                "disclaimer", "Modelo estadístico genérico.",
                "queryLatencyMs", 5L
        );

        when(postGisAnalyticsService.getAftershockForecast()).thenReturn(mockForecast);

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

    @Test
    @DisplayName("GET /api/v1/analytics/historical-insights retorna métricas avanzadas si BigQuery está disponible")
    void shouldReturnHistoricalInsightsWhenAvailable() throws Exception {
        Map<String, Object> mockInsights = Map.of(
                "completenessMc", 4.5,
                "bValue", 0.94,
                "bValueStdErr", 0.03,
                "completenessNote", "Catálogo completo desde M≈4.5 · b = 0.94 ± 0.03",
                "anomalyRatios", List.of(Map.of("iso2", "CR", "country", "Costa Rica", "ratio", 1.2)),
                "yearlySeries", List.of(Map.of("year", 2020, "count", 450)),
                "top10", List.of(Map.of("eventId", "test7", "magnitude", 7.7))
        );

        when(postGisAnalyticsService.getRecentCountByCountryM45()).thenReturn(Map.of("CR", 10));
        when(bigQueryAnalyticsService.getHistoricalInsights(org.mockito.ArgumentMatchers.any())).thenReturn(Optional.of(mockInsights));

        mockMvc.perform(get("/api/v1/analytics/historical-insights"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completenessMc").value(4.5))
                .andExpect(jsonPath("$.bValue").value(0.94))
                .andExpect(jsonPath("$.anomalyRatios[0].country").value("Costa Rica"))
                .andExpect(jsonPath("$.top10[0].magnitude").value(7.7));
    }

    @Test
    @DisplayName("GET /api/v1/analytics/historical-insights retorna HTTP 503 si BigQuery no está disponible")
    void shouldReturn503ForHistoricalInsightsWhenUnavailable() throws Exception {
        when(bigQueryAnalyticsService.getHistoricalInsights(org.mockito.ArgumentMatchers.any())).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/analytics/historical-insights"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("HISTORICAL_UNAVAILABLE"));
    }
}
