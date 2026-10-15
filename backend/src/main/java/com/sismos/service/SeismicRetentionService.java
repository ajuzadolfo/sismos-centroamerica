package com.sismos.service;

import com.sismos.repository.SeismicEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Servicio de retención y poda periódica en PostgreSQL / PostGIS.
 * Mantiene la base de datos operacional compacta para que los índices GiST residan en RAM,
 * delegando la conservación histórica ilimitada (40+ años) en BigQuery.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SeismicRetentionService {

    private final SeismicEventRepository seismicEventRepository;

    @Value("${sismos.retention.days:90}")
    private int retentionDays;

    @Scheduled(cron = "${sismos.retention.cron:0 0 3 * * SUN}") // Ejecución semanal los domingos a las 03:00 AM
    public int purgeExpiredEvents() {
        Instant cutoff = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        log.info("[PostGIS Retention] Iniciando purga de sismos con antigüedad superior a {} días (corte: {})...", retentionDays, cutoff);
        try {
            int deleted = seismicEventRepository.deleteEventsOlderThan(cutoff);
            log.info("[PostGIS Retention] Purga completada exitosamente. Se eliminaron {} eventos antiguos. Índices GiST optimizados.", deleted);
            return deleted;
        } catch (Exception e) {
            log.error("[PostGIS Retention] Error durante la purga de sismos antiguos: {}", e.getMessage(), e);
            return 0;
        }
    }
}
