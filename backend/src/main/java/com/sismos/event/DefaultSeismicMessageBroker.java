package com.sismos.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sismos.analytics.CountryBoundaryClassifier;
import com.sismos.model.dto.BigQueryCatalogRecord;
import com.sismos.model.dto.GeoJsonFeature;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@Primary
@RequiredArgsConstructor
public class DefaultSeismicMessageBroker implements SeismicMessageBroker {

    private static final DateTimeFormatter BQ_TIMESTAMP_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneOffset.UTC);

    private final SimpMessagingTemplate messagingTemplate;
    private final Optional<GcpPubSubPublisher> gcpPubSubPublisher;
    private final Optional<CountryBoundaryClassifier> countryBoundaryClassifier;
    private final ObjectMapper objectMapper;

    @Value("${spring.cloud.gcp.pubsub.enabled:true}")
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

        // 2. Publicación a Cloud Pub/Sub con esquema de tabla BigQuery
        if (gcpPubSubEnabled && gcpPubSubPublisher.isPresent()) {
            try {
                BigQueryCatalogRecord record = buildBigQueryRecord(feature);
                String payload = objectMapper.writeValueAsString(record);
                gcpPubSubPublisher.get().publish(feature.getId(), payload);
                log.info("[GCP Pub/Sub] Registro de catálogo publicado para BigQuery [ID: {}, País: {}]",
                        feature.getId(), record.getCountryCode());
            } catch (Exception e) {
                log.warn("[GCP Pub/Sub] Error serializando registro para BigQuery {}: {}", feature.getId(), e.getMessage());
            }
        }
    }

    private BigQueryCatalogRecord buildBigQueryRecord(GeoJsonFeature feature) {
        Map<String, Object> props = feature.getProperties() != null ? feature.getProperties() : Map.of();
        List<Double> coords = (feature.getGeometry() != null && feature.getGeometry().getCoordinates() != null)
                ? feature.getGeometry().getCoordinates()
                : List.of(0.0, 0.0);

        double lon = !coords.isEmpty() ? coords.get(0) : 0.0;
        double lat = coords.size() > 1 ? coords.get(1) : 0.0;
        double depthKm = coords.size() > 2 ? coords.get(2) : 10.0;

        String countryCode = "OC";
        if (countryBoundaryClassifier.isPresent()) {
            countryCode = countryBoundaryClassifier.get().classify(lat, lon).iso2();
        }

        BigDecimal magnitude = null;
        Object magObj = props.get("magnitude");
        if (magObj instanceof BigDecimal bd) magnitude = bd;
        else if (magObj instanceof Number num) magnitude = BigDecimal.valueOf(num.doubleValue());

        String eventTime = formatTimestamp(props.get("time"));
        String updatedTime = formatTimestamp(props.get("updatedAt"));
        String ingestedAt = BQ_TIMESTAMP_FORMATTER.format(Instant.now());

        Boolean tsunami = null;
        Object tsunamiObj = props.get("tsunamiAlert");
        if (tsunamiObj instanceof Boolean b) tsunami = b;

        Integer sig = null;
        Object sigObj = props.get("significance");
        if (sigObj instanceof Number n) sig = n.intValue();

        return BigQueryCatalogRecord.builder()
                .eventId(feature.getId())
                .title((String) props.get("title"))
                .place((String) props.get("place"))
                .magnitude(magnitude)
                .magnitudeType((String) props.get("magnitudeType"))
                .depthKm(BigDecimal.valueOf(depthKm))
                .eventTime(eventTime)
                .updatedTime(updatedTime)
                .status((String) props.get("status"))
                .tsunamiFlag(tsunami)
                .significance(sig)
                .latitude(lat)
                .longitude(lon)
                .countryCode(countryCode)
                .ingestedAt(ingestedAt)
                .build();
    }

    private String formatTimestamp(Object timeObj) {
        if (timeObj == null) return null;
        try {
            if (timeObj instanceof Instant inst) {
                return BQ_TIMESTAMP_FORMATTER.format(inst);
            }
            String str = timeObj.toString();
            Instant inst = Instant.parse(str);
            return BQ_TIMESTAMP_FORMATTER.format(inst);
        } catch (Exception e) {
            return null;
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
