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
}

