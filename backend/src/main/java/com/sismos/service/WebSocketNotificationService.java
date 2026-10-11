package com.sismos.service;

import com.sismos.event.SeismicEventPersistedEvent;
import com.sismos.mapper.GeoJsonMapper;
import com.sismos.model.dto.GeoJsonFeature;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketNotificationService {

    private final com.sismos.event.SeismicMessageBroker messageBroker;
    private final GeoJsonMapper geoJsonMapper;

    /**
     * Escucha eventos sísmicos persistidos y los transmite mediante el broker desacoplado.
     */
    @EventListener
    public void handleSeismicEventPersisted(SeismicEventPersistedEvent event) {
        try {
            GeoJsonFeature feature = geoJsonMapper.toFeature(event.getSeismicEvent());
            messageBroker.publishSeismicEvent(feature);
        } catch (Exception e) {
            log.error("Error al transmitir notificacion de sismo: {}", e.getMessage(), e);
        }
    }

    /**
     * Transmite actualizaciones en tiempo real del contador y promedio de reportes ciudadanos.
     */
    public void notifyCitizenReport(String eventId, long totalReports, Double averageIntensity) {
        try {
            messageBroker.publishCitizenReport(eventId, totalReports, averageIntensity);
        } catch (Exception e) {
            log.error("Error al transmitir notificacion de reporte ciudadano: {}", e.getMessage(), e);
        }
    }
}

