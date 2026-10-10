package com.sismos.repository;

import com.sismos.model.entity.GeologicalFault;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GeologicalFaultRepository extends JpaRepository<GeologicalFault, Long> {

    List<GeologicalFault> findByCountryCode(String countryCode);

    // Retorna todas las fallas formateadas directamente como FeatureCollection GeoJSON
    @Query(value = """
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', json_agg(
                json_build_object(
                    'type', 'Feature',
                    'id', id,
                    'geometry', ST_AsGeoJSON(geom)::json,
                    'properties', json_build_object(
                        'name', name,
                        'fault_type', fault_type,
                        'country_code', country_code
                    )
                )
            )
        )
        FROM geological_faults
        """, nativeQuery = true)
    String findAllAsGeoJsonFeatureCollection();
}
