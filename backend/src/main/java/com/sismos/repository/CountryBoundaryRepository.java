package com.sismos.repository;

import com.sismos.model.entity.CountryBoundary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CountryBoundaryRepository extends JpaRepository<CountryBoundary, String> {

    @Query(value = """
        SELECT iso2 FROM country_boundaries
        WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
        LIMIT 1
        """, nativeQuery = true)
    Optional<String> findContainingCountryIso(@Param("lon") double lon, @Param("lat") double lat);

    @Query(value = """
        SELECT iso2 FROM country_boundaries
        WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :maxDistanceMeters)
        ORDER BY ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) ASC
        LIMIT 1
        """, nativeQuery = true)
    Optional<String> findNearestCountryWithinDistance(
            @Param("lon") double lon,
            @Param("lat") double lat,
            @Param("maxDistanceMeters") double maxDistanceMeters
    );
}
