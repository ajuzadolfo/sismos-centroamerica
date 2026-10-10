package com.sismos.service;

import com.sismos.config.SismosProperties;
import com.sismos.event.SeismicEventPersistedEvent;
import com.sismos.model.dto.usgs.UsgsFeature;
import com.sismos.model.dto.usgs.UsgsFeatureCollection;
import com.sismos.model.dto.usgs.UsgsProperties;
import com.sismos.model.entity.SeismicEvent;
import com.sismos.repository.SeismicEventRepository;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class UsgsIngestionService {

    private final SeismicEventRepository seismicEventRepository;
    private final SismosProperties properties;
    private final ApplicationEventPublisher eventPublisher;
    private final RestClient restClient;
    private final GeometryFactory geometryFactory;

    public UsgsIngestionService(
            SeismicEventRepository seismicEventRepository,
            SismosProperties properties,
            ApplicationEventPublisher eventPublisher
    ) {
        this.seismicEventRepository = seismicEventRepository;
        this.properties = properties;
        this.eventPublisher = eventPublisher;
        this.restClient = RestClient.builder().build();
        this.geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);
    }

    /**
     * Tarea programada: Consume el feed GeoJSON de la CDN de USGS cada 60 segundos.
     * ShedLock garantiza que solo una instancia ejecute el polling en Cloud Run multi-instancia.
     */
    @Scheduled(fixedDelayString = "${sismos.ingestion.cron-rate-ms:60000}")
    @SchedulerLock(name = "usgs_live_ingest_lock", lockAtLeastFor = "PT20S", lockAtMostFor = "PT50S")
    public void ingestLiveFeed() {
        String cdnUrl = properties.getIngestion().getUsgsCdnUrl();
        log.debug("Iniciando sondeo de eventos sismicos en vivo desde USGS CDN: {}", cdnUrl);

        try {
            UsgsFeatureCollection collection = restClient.get()
                    .uri(cdnUrl)
                    .retrieve()
                    .body(UsgsFeatureCollection.class);

            if (collection != null && collection.getFeatures() != null) {
                processFeatures(collection.getFeatures());
            }
        } catch (Exception e) {
            log.error("Error durante el sondeo en vivo de la USGS: {}", e.getMessage(), e);
        }
    }

    /**
     * Sincronización histórica usando el endpoint dinámico FDSN de la USGS con filtro regional.
     */
    @Transactional
    public int syncHistoricalData(int daysBack) {
        Instant startTime = Instant.now().minus(daysBack, ChronoUnit.DAYS);
        SismosProperties.RegionProperties region = properties.getRegion();

        String uri = UriComponentsBuilder.fromHttpUrl(properties.getIngestion().getUsgsFdsnBaseUrl())
                .queryParam("format", "geojson")
                .queryParam("minlatitude", region.getMinLatitude())
                .queryParam("maxlatitude", region.getMaxLatitude())
                .queryParam("minlongitude", region.getMinLongitude())
                .queryParam("maxlongitude", region.getMaxLongitude())
                .queryParam("starttime", startTime.toString())
                .queryParam("orderby", "time")
                .toUriString();

        log.info("Sincronizando historico sismico desde USGS FDSN (ultimos {} dias): {}", daysBack, uri);

        try {
            UsgsFeatureCollection collection = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(UsgsFeatureCollection.class);

            if (collection != null && collection.getFeatures() != null) {
                return processFeatures(collection.getFeatures());
            }
        } catch (Exception e) {
            log.error("Error en sincronizacion historica de USGS: {}", e.getMessage(), e);
        }
        return 0;
    }

    @Transactional
    public int processFeatures(List<UsgsFeature> features) {
        int processedCount = 0;
        List<SeismicEvent> toSave = new ArrayList<>();

        for (UsgsFeature feature : features) {
            if (!isValidFeature(feature)) {
                continue;
            }

            List<Double> coords = feature.getGeometry().getCoordinates();
            double lon = coords.get(0);
            double lat = coords.get(1);

            // Filtrar solo los sismos dentro del cuadrante de Centroamérica
            if (!isInCentralAmerica(lat, lon)) {
                continue;
            }

            double depth = coords.size() > 2 && coords.get(2) != null ? coords.get(2) : 10.0;
            UsgsProperties props = feature.getProperties();

            Point point = geometryFactory.createPoint(new Coordinate(lon, lat));
            point.setSRID(4326);

            Instant eventTime = Instant.ofEpochMilli(props.getTime());
            Instant updatedAt = props.getUpdated() != null ? Instant.ofEpochMilli(props.getUpdated()) : eventTime;

            Optional<SeismicEvent> existingOpt = seismicEventRepository.findById(feature.getId());
            boolean isNew = existingOpt.isEmpty();

            SeismicEvent event;
            if (isNew) {
                event = SeismicEvent.builder()
                        .id(feature.getId())
                        .title(props.getTitle() != null ? props.getTitle() : "Sismo en Centroamérica")
                        .place(props.getPlace())
                        .time(eventTime)
                        .updatedAt(updatedAt)
                        .magnitude(props.getMag() != null ? props.getMag() : BigDecimal.ZERO)
                        .magnitudeType(props.getMagType())
                        .depth(BigDecimal.valueOf(depth))
                        .status(props.getStatus() != null ? props.getStatus().toUpperCase() : "AUTOMATIC")
                        .alertLevel(props.getAlert())
                        .significance(props.getSig())
                        .tsunamiAlert(props.getTsunami() != null && props.getTsunami() == 1)
                        .geom(point)
                        .build();

                toSave.add(event);
                processedCount++;
            } else {
                event = existingOpt.get();
                // Solo actualizamos si el evento fue modificado o revisado por la USGS
                if (updatedAt.isAfter(event.getUpdatedAt())) {
                    event.setUpdatedAt(updatedAt);
                    event.setTitle(props.getTitle());
                    event.setPlace(props.getPlace());
                    event.setMagnitude(props.getMag() != null ? props.getMag() : event.getMagnitude());
                    event.setMagnitudeType(props.getMagType());
                    event.setDepth(BigDecimal.valueOf(depth));
                    event.setStatus(props.getStatus() != null ? props.getStatus().toUpperCase() : event.getStatus());
                    event.setAlertLevel(props.getAlert());
                    event.setSignificance(props.getSig());
                    event.setTsunamiAlert(props.getTsunami() != null && props.getTsunami() == 1);
                    event.setGeom(point);

                    toSave.add(event);
                    processedCount++;
                }
            }
        }

        if (!toSave.isEmpty()) {
            List<SeismicEvent> savedEvents = seismicEventRepository.saveAll(toSave);
            for (SeismicEvent saved : savedEvents) {
                eventPublisher.publishEvent(new SeismicEventPersistedEvent(this, saved, true));
            }
            log.info("Persistidos/actualizados {} sismos en Centroamerica", savedEvents.size());
        }

        return processedCount;
    }

    private boolean isValidFeature(UsgsFeature feature) {
        return feature != null
                && feature.getId() != null
                && feature.getGeometry() != null
                && feature.getGeometry().getCoordinates() != null
                && feature.getGeometry().getCoordinates().size() >= 2
                && feature.getProperties() != null
                && feature.getProperties().getTime() != null;
    }

    private boolean isInCentralAmerica(double lat, double lon) {
        SismosProperties.RegionProperties region = properties.getRegion();
        return lat >= region.getMinLatitude() && lat <= region.getMaxLatitude()
                && lon >= region.getMinLongitude() && lon <= region.getMaxLongitude();
    }
}
