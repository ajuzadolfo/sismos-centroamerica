package com.sismos.repository;

import com.sismos.model.entity.SeismicEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Repository
public interface SeismicEventRepository extends JpaRepository<SeismicEvent, String> {

    List<SeismicEvent> findByTimeAfterOrderByTimeDesc(Instant since);

    List<SeismicEvent> findTop50ByOrderByTimeDesc();

    // Consultas para RAG Inteligente en Cabrakán AI
    @Query(value = """
        SELECT * FROM seismic_events
        WHERE (LOWER(place) LIKE LOWER(CONCAT('%', :keyword, '%'))
            OR LOWER(title) LIKE LOWER(CONCAT('%', :keyword, '%')))
          AND time >= :since
        ORDER BY magnitude DESC, time DESC
        LIMIT 10
        """, nativeQuery = true)
    List<SeismicEvent> findRecentByPlaceKeyword(
            @Param("keyword") String keyword,
            @Param("since") Instant since
    );

    @Query(value = """
        SELECT * FROM seismic_events
        WHERE time >= :since AND magnitude >= :minMagnitude
        ORDER BY magnitude DESC, time DESC
        LIMIT 10
        """, nativeQuery = true)
    List<SeismicEvent> findTopSignificantEvents(
            @Param("since") Instant since,
            @Param("minMagnitude") BigDecimal minMagnitude
    );

    // Consulta espacial por Bounding Box (delimitación del mapa en pantalla)
    @Query(value = """
        SELECT * FROM seismic_events
        WHERE geom && ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326)
          AND time >= :since
          AND magnitude >= :minMagnitude
        ORDER BY time DESC
        """, nativeQuery = true)
    List<SeismicEvent> findWithinBoundingBox(
            @Param("minLon") double minLon,
            @Param("minLat") double minLat,
            @Param("maxLon") double maxLon,
            @Param("maxLat") double maxLat,
            @Param("since") Instant since,
            @Param("minMagnitude") BigDecimal minMagnitude
    );

    // Consulta radial geodésica (sismos dentro de un radio en metros desde un punto)
    @Query(value = """
        SELECT * FROM seismic_events
        WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :radiusMeters)
          AND time >= :since
        ORDER BY time DESC
        """, nativeQuery = true)
    List<SeismicEvent> findWithinRadius(
            @Param("lon") double lon,
            @Param("lat") double lat,
            @Param("radiusMeters") double radiusMeters,
            @Param("since") Instant since
    );

    // Distancia geodésica en metros entre un punto y el epicentro del sismo
    @Query(value = """
        SELECT ST_Distance(
            geom::geography,
            ST_SetSRID(ST_MakePoint(:repLon, :repLat), 4326)::geography
        )
        FROM seismic_events
        WHERE id = :eventId
        """, nativeQuery = true)
    Double calculateDistanceToEpicenter(
            @Param("eventId") String eventId,
            @Param("repLon") double repLon,
            @Param("repLat") double repLat
    );

    // Agregación regional de 30 días en PostGIS con clasificación por fronteras oficiales
    @Query(value = """
        SELECT
            COALESCE(
                CASE 
                    WHEN assigned.iso2 = 'GT' THEN 'Guatemala'
                    WHEN assigned.iso2 = 'SV' THEN 'El Salvador'
                    WHEN assigned.iso2 = 'HN' THEN 'Honduras'
                    WHEN assigned.iso2 = 'NI' THEN 'Nicaragua'
                    WHEN assigned.iso2 = 'CR' THEN 'Costa Rica'
                    WHEN assigned.iso2 = 'PA' THEN 'Panamá'
                    WHEN assigned.iso2 IN ('MX', 'BZ', 'CO') THEN 'Fuera de Centroamérica'
                    ELSE 'Otros / Océano'
                END,
                'Otros / Océano'
            ) AS countryLabel,
            COUNT(*) AS totalCount,
            COUNT(*) FILTER (WHERE e.magnitude < 3.5) AS magMenor,
            COUNT(*) FILTER (WHERE e.magnitude >= 3.5 AND e.magnitude < 4.5) AS magModerado,
            COUNT(*) FILTER (WHERE e.magnitude >= 4.5 AND e.magnitude < 6.0) AS magFuerte,
            COUNT(*) FILTER (WHERE e.magnitude >= 6.0) AS magMayor,
            COUNT(*) FILTER (WHERE e.depth < 30) AS someros,
            COUNT(*) FILTER (WHERE e.depth >= 30 AND e.depth <= 70) AS intermedios,
            COUNT(*) FILTER (WHERE e.depth > 70) AS profundos
        FROM seismic_events e
        LEFT JOIN LATERAL (
            SELECT cb.iso2
            FROM country_boundaries cb
            WHERE ST_Contains(cb.geom, e.geom)
               OR ST_DWithin(cb.geom::geography, e.geom::geography, 100000)
            ORDER BY 
                CASE WHEN ST_Contains(cb.geom, e.geom) THEN 0 ELSE 1 END,
                ST_Distance(cb.geom::geography, e.geom::geography) ASC
            LIMIT 1
        ) assigned ON TRUE
        WHERE e.time >= :since
        GROUP BY 1
        """, nativeQuery = true)
    List<com.sismos.repository.projection.RegionalSummaryRow> getRegionalSummaryAggregation(@Param("since") Instant since);

    @Query(value = """
        SELECT
            COALESCE(
                CASE 
                    WHEN assigned.iso2 = 'GT' THEN 'GT'
                    WHEN assigned.iso2 = 'SV' THEN 'SV'
                    WHEN assigned.iso2 = 'HN' THEN 'HN'
                    WHEN assigned.iso2 = 'NI' THEN 'NI'
                    WHEN assigned.iso2 = 'CR' THEN 'CR'
                    WHEN assigned.iso2 = 'PA' THEN 'PA'
                    ELSE 'OC'
                END,
                'OC'
            ) AS countryIso,
            COUNT(*) AS countM45
        FROM seismic_events e
        LEFT JOIN LATERAL (
            SELECT cb.iso2
            FROM country_boundaries cb
            WHERE ST_Contains(cb.geom, e.geom)
               OR ST_DWithin(cb.geom::geography, e.geom::geography, 100000)
            ORDER BY 
                CASE WHEN ST_Contains(cb.geom, e.geom) THEN 0 ELSE 1 END,
                ST_Distance(cb.geom::geography, e.geom::geography) ASC
            LIMIT 1
        ) assigned ON TRUE
        WHERE e.time >= :since AND e.magnitude >= :minMag
        GROUP BY 1
        """, nativeQuery = true)
    List<com.sismos.repository.projection.CountryCountRow> countRecentEventsByCountry(
            @Param("since") Instant since,
            @Param("minMag") BigDecimal minMag
    );

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query(value = "DELETE FROM seismic_events WHERE time < :cutoffTime", nativeQuery = true)
    int deleteEventsOlderThan(@Param("cutoffTime") Instant cutoffTime);
}

