package com.sismos.controller;

import com.sismos.model.entity.SeismicEvent;
import com.sismos.repository.SeismicEventRepository;
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
import java.util.Collections;
import java.util.List;

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

    @Test
    @DisplayName("GET /api/v1/analytics/regional-summary debe retornar métricas geodinámicas")
    void shouldReturnRegionalSummary() throws Exception {
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

        mockMvc.perform(get("/api/v1/analytics/regional-summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalEventsAnalyzed").value(1))
                .andExpect(jsonPath("$.countryDistribution.Nicaragua").value(1))
                .andExpect(jsonPath("$.magnitudeDistribution.fuerte").value(1));
    }

    @Test
    @DisplayName("GET /api/v1/analytics/aftershock-forecast debe retornar pronóstico de Omori")
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
                .andExpect(jsonPath("$.forecastWindow24h.estimatedAftershockCount").isNumber());
    }
}
