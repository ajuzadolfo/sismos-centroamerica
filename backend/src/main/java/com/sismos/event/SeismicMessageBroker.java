package com.sismos.event;

import com.sismos.model.dto.GeoJsonFeature;

/**
 * Abstracción de mensajería para desacoplamiento multi-cloud.
 * Permite emitir eventos a través de Cloud Pub/Sub, Apache Kafka, AWS SQS o WebSockets en memoria.
 */
public interface SeismicMessageBroker {

    void publishSeismicEvent(GeoJsonFeature feature);

    void publishCitizenReport(String eventId, long totalReports, Double averageIntensity);
}
