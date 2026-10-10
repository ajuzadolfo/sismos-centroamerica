package com.sismos.controller;

import com.sismos.mapper.GeoJsonMapper;
import com.sismos.model.entity.SeismicEvent;
import com.sismos.repository.CitizenReportRepository;
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
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SeismicEventController.class)
@Import(GeoJsonMapper.class)
class SeismicEventControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SeismicEventRepository seismicEventRepository;

    @MockBean
    private CitizenReportRepository citizenReportRepository;

    @MockBean
    private com.sismos.service.UsgsIngestionService usgsIngestionService;

    @Test
    @DisplayName("GET /api/v1/earthquakes/recent debe devolver FeatureCollection GeoJSON")
    void shouldReturnRecentEarthquakesAsGeoJson() throws Exception {
        GeometryFactory factory = new GeometryFactory(new PrecisionModel(), 4326);
        Point point = factory.createPoint(new Coordinate(-86.2, 12.1));
        point.setSRID(4326);

        SeismicEvent event = SeismicEvent.builder()
                .id("us7000test")
                .title("M 4.2 - Managua, Nicaragua")
                .place("Managua, Nicaragua")
                .time(Instant.parse("2026-10-09T20:00:00Z"))
                .updatedAt(Instant.parse("2026-10-09T20:05:00Z"))
                .magnitude(BigDecimal.valueOf(4.2))
                .depth(BigDecimal.valueOf(10.0))
                .status("REVIEWED")
                .geom(point)
                .build();

        when(seismicEventRepository.findTop50ByOrderByTimeDesc()).thenReturn(List.of(event));

        mockMvc.perform(get("/api/v1/earthquakes/recent")
                        .accept("application/geo+json"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/geo+json"))
                .andExpect(jsonPath("$.type").value("FeatureCollection"))
                .andExpect(jsonPath("$.features[0].id").value("us7000test"))
                .andExpect(jsonPath("$.features[0].geometry.type").value("Point"))
                .andExpect(jsonPath("$.features[0].geometry.coordinates[0]").value(-86.2))
                .andExpect(jsonPath("$.features[0].geometry.coordinates[1]").value(12.1))
                .andExpect(jsonPath("$.features[0].properties.title").value("M 4.2 - Managua, Nicaragua"));
    }

    @Test
    @DisplayName("GET /api/v1/earthquakes/{id} debe devolver 404 si no existe")
    void shouldReturn404WhenNotFound() throws Exception {
        when(seismicEventRepository.findById("nonexistent")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/earthquakes/nonexistent"))
                .andExpect(status().isNotFound());
    }
}
