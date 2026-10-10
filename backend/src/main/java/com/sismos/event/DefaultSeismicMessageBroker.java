package com.sismos.event;

import com.sismos.model.dto.GeoJsonFeature;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

@Slf4j
@Service
@Primary
@RequiredArgsConstructor
public class DefaultSeismicMessageBroker implements SeismicMessageBroker {

    private final SimpMessagingTemplate messagingTemplate;

    @Value("${spring.cloud.gcp.pubsub.enabled:false}")
    private boolean gcpPubSubEnabled;

    @Value("${app.messaging.broker:websocket}")
    private String configuredBroker;

    @Override
    public void publishSeismicEvent(GeoJsonFeature feature) {
        // 1. Despacho a clientes WebSocket STOMP
        messagingTemplate.convertAndSend("/topic/earthquakes", feature);
        log.info("[Event Broker: {}] Evento sismico despachado a /topic/earthquakes [ID: {}, Mag: {}]",
                configuredBroker, feature.getId(), feature.getProperties().getMagnitude());

        // 2. Simulación / Integración con Cloud Pub/Sub si está habilitado
        if (gcpPubSubEnabled) {
            log.info("[GCP Pub/Sub] Publicando mensaje al topico 'seismic-events' para fan-out a BigQuery y Cloud Functions: {}", feature.getId());
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
