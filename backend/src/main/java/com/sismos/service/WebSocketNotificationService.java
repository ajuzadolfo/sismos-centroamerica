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

    private final SimpMessagingTemplate messagingTemplate;
    private final GeoJsonMapper geoJsonMapper;

    /**
     * Escucha eventos sísmicos persistidos y los transmite de inmediato a todos los navegadores
     * conectados al canal /topic/earthquakes.
     */
    @EventListener
    public void handleSeismicEventPersisted(SeismicEventPersistedEvent event) {
        try {
            GeoJsonFeature feature = geoJsonMapper.toFeature(event.getSeismicEvent());
            messagingTemplate.convertAndSend("/topic/earthquakes", feature);
            log.info("Notificacion WebSocket emitida a /topic/earthquakes para sismo ID: {} [Mag: {}]",
                    feature.getId(),
                    event.getSeismicEvent().getMagnitude());
        } catch (Exception e) {
            log.error("Error al transmitir notificacion WebSocket: {}", e.getMessage(), e);
        }
    }

    /**
     * Transmite actualizaciones en tiempo real del contador y promedio de reportes ciudadanos
     * para un sismo específico.
     */
    public void notifyCitizenReport(String eventId, long totalReports, Double averageIntensity) {
        try {
            java.util.Map<String, Object> update = java.util.Map.of(
                    "eventId", eventId,
                    "totalCitizenReports", totalReports,
                    "averagePerceivedIntensity", averageIntensity != null ? averageIntensity : 0.0,
                    "updatedAt", java.time.Instant.now().toString()
            );
            messagingTemplate.convertAndSend("/topic/earthquakes/" + eventId + "/reports", update);
            messagingTemplate.convertAndSend("/topic/reports", update);
            log.info("Notificacion WebSocket emitida para reportes del sismo ID: {} [Total: {}]", eventId, totalReports);
        } catch (Exception e) {
            log.error("Error al transmitir notificacion de reporte ciudadano: {}", e.getMessage(), e);
        }
    }
}

