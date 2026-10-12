package com.sismos.event;

import com.google.protobuf.ByteString;
import com.google.pubsub.v1.PubsubMessage;
import com.google.pubsub.v1.TopicName;
import com.google.cloud.pubsub.v1.Publisher;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
@Slf4j
@ConditionalOnProperty(name = "spring.cloud.gcp.pubsub.enabled", havingValue = "true")
public class GcpPubSubPublisher {

    @Value("${spring.cloud.gcp.project-id:${PROJECT_ID:sismos-centroamerica-prod}}")
    private String projectId;

    @Value("${app.messaging.pubsub.topic:seismic-events-topic}")
    private String topicId;

    private Publisher publisher;

    public synchronized void initPublisher() {
        if (publisher == null) {
            try {
                TopicName topicName = TopicName.of(projectId, topicId);
                this.publisher = Publisher.newBuilder(topicName).build();
                log.info("[GCP Pub/Sub] Publicador inicializado con exito para el topico: {}", topicName);
            } catch (Exception e) {
                log.warn("[GCP Pub/Sub] No se pudo conectar al topico '{}': {}", topicId, e.getMessage());
            }
        }
    }

    public void publish(String eventId, String payloadJson) {
        if (publisher == null) {
            initPublisher();
        }
        if (publisher == null) {
            log.warn("[GCP Pub/Sub] Publisher no disponible. Mensaje omitido para sismo: {}", eventId);
            return;
        }

        try {
            PubsubMessage pubsubMessage = PubsubMessage.newBuilder()
                    .setData(ByteString.copyFromUtf8(payloadJson))
                    .setMessageId(eventId)
                    .build();

            publisher.publish(pubsubMessage);
            log.debug("[GCP Pub/Sub] Evento publicado en {}: {}", topicId, eventId);
        } catch (Exception e) {
            log.error("[GCP Pub/Sub] Error al publicar evento sismico {}: {}", eventId, e.getMessage(), e);
        }
    }

    @PreDestroy
    public void cleanup() {
        if (publisher != null) {
            try {
                publisher.shutdown();
                publisher.awaitTermination(3, TimeUnit.SECONDS);
            } catch (Exception e) {
                log.warn("Error al apagar el publicador Pub/Sub: {}", e.getMessage());
            }
        }
    }
}
