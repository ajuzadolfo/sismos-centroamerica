package com.sismos.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sismos.model.dto.GeoJsonFeature;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@Primary
@RequiredArgsConstructor
public class DefaultSeismicMessageBroker implements SeismicMessageBroker {

    private final SimpMessagingTemplate messagingTemplate;
    private final Optional<GcpPubSubPublisher> gcpPubSubPublisher;
    private final ObjectMapper objectMapper;

    @Value("${spring.cloud.gcp.pubsub.enabled:false}")
    private boolean gcpPubSubEnabled;

    @Value("${app.messaging.broker:websocket}")
    private String configuredBroker;

    @Override
    public void publishSeismicEvent(GeoJsonFeature feature) {
        // 1. Despacho a clientes WebSocket STOMP
        Object mag = feature.getProperties() != null ? feature.getProperties().get("magnitude") : "N/A";
        log.info("[Event Broker: {}] Evento sismico despachado a /topic/earthquakes [ID: {}, Mag: {}]",
                configuredBroker, feature.getId(), mag);
        messagingTemplate.convertAndSend("/topic/earthquakes", feature);

        // 2. Publicación a Cloud Pub/Sub si está habilitado
        if (gcpPubSubEnabled && gcpPubSubPublisher.isPresent()) {
            try {
                String payload = objectMapper.writeValueAsString(feature);
                gcpPubSubPublisher.get().publish(feature.getId(), payload);
                log.info("[GCP Pub/Sub] Evento sísmico publicado en tópico 'seismic-events': {}", feature.getId());
            } catch (Exception e) {
                log.warn("[GCP Pub/Sub] Error serializando evento sísmico {}: {}", feature.getId(), e.getMessage());
            }
        }
    }

    @Override
    public void publishCitizenReport(String eventId, long totalReports, Double averageIntensity) {
        Map<String, Object> update = Map.of(
                "eventId", eventId,
                "totalCitizenReports", totalReports,
                "averagePerceivedIntensity", averageIntensity != null ? averageIntensity : 0.0,
                "updatedAt", Instant.now().toString()
        );

        messagingTemplate.convertAndSend("/topic/earthquakes/" + eventId + "/reports", update);
        messagingTemplate.convertAndSend("/topic/reports", update);

        if (gcpPubSubEnabled) {
            log.info("[GCP Pub/Sub] Publicando actualizacion de reporte ciudadano para evento: {}", eventId);
        }
    }
}
