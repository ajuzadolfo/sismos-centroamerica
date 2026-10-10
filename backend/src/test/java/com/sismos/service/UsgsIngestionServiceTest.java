package com.sismos.service;

import com.sismos.config.SismosProperties;
import com.sismos.model.dto.usgs.UsgsFeature;
import com.sismos.model.dto.usgs.UsgsGeometry;
import com.sismos.model.dto.usgs.UsgsProperties;
import com.sismos.model.entity.SeismicEvent;
import com.sismos.repository.SeismicEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UsgsIngestionServiceTest {

    @Mock
    private SeismicEventRepository seismicEventRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private UsgsIngestionService ingestionService;

    @BeforeEach
    void setUp() {
        SismosProperties properties = new SismosProperties();
        ingestionService = new UsgsIngestionService(seismicEventRepository, properties, eventPublisher);
    }

    @Test
    @DisplayName("Debe procesar sismo dentro de Centroamérica y descartar sismos fuera del cuadrante")
    void shouldProcessCentralAmericaEarthquakesAndIgnoreOutside() {
        // Sismo 1: En El Salvador / Guatemala (Lat: 13.9, Lon: -90.1) -> DENTRO
        UsgsFeature insideFeature = new UsgsFeature();
        insideFeature.setId("us7000test1");
        UsgsGeometry geom1 = new UsgsGeometry();
        geom1.setCoordinates(List.of(-90.1, 13.9, 25.5)); // [lon, lat, depth]
        insideFeature.setGeometry(geom1);
        UsgsProperties props1 = new UsgsProperties();
        props1.setTitle("M 5.2 - Off coast of El Salvador");
        props1.setMag(BigDecimal.valueOf(5.2));
        props1.setTime(1712345678000L);
        props1.setStatus("reviewed");
        insideFeature.setProperties(props1);

        // Sismo 2: En Japón (Lat: 35.6, Lon: 139.6) -> FUERA
        UsgsFeature outsideFeature = new UsgsFeature();
        outsideFeature.setId("us7000japan");
        UsgsGeometry geom2 = new UsgsGeometry();
        geom2.setCoordinates(List.of(139.6, 35.6, 10.0));
        outsideFeature.setGeometry(geom2);
        UsgsProperties props2 = new UsgsProperties();
        props2.setTitle("M 6.0 - Near Tokyo");
        props2.setMag(BigDecimal.valueOf(6.0));
        props2.setTime(1712345678000L);
        outsideFeature.setProperties(props2);

        when(seismicEventRepository.findById("us7000test1")).thenReturn(Optional.empty());
        when(seismicEventRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        int processed = ingestionService.processFeatures(List.of(insideFeature, outsideFeature));

        assertEquals(1, processed, "Solo debe procesar el sismo dentro de Centroamérica");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<SeismicEvent>> captor = ArgumentCaptor.forClass(List.class);
        verify(seismicEventRepository).saveAll(captor.capture());

        List<SeismicEvent> savedList = captor.getValue();
        assertEquals(1, savedList.size());

        SeismicEvent saved = savedList.getFirst();
        assertEquals("us7000test1", saved.getId());
        assertEquals(new BigDecimal("5.2"), saved.getMagnitude());
        assertEquals(-90.1, saved.getLongitude(), 0.001);
        assertEquals(13.9, saved.getLatitude(), 0.001);
        assertEquals(0, new BigDecimal("25.50").compareTo(saved.getDepth()));
        assertEquals(4326, saved.getGeom().getSRID());
    }
}
