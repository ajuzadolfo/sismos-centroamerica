package com.sismos.repository;

import com.sismos.model.entity.CitizenReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CitizenReportRepository extends JpaRepository<CitizenReport, UUID> {

    List<CitizenReport> findByEventIdOrderByReportedAtDesc(String eventId);

    long countByEventId(String eventId);

    boolean existsByEventIdAndClientFingerprint(String eventId, String clientFingerprint);

    // Consulta de agregación para mapa de calor comunitario agrupado por cuadrícula espacial
    @Query(value = """
        SELECT
            ST_AsGeoJSON(ST_Centroid(ST_Collect(geom))) as center_geojson,
            ROUND(AVG(perceived_intensity), 2) as average_intensity,
            COUNT(*) as report_count
        FROM citizen_reports
        WHERE event_id = :eventId
        GROUP BY ST_SnapToGrid(geom, 0.05)
        """, nativeQuery = true)
    List<Object[]> findIntensityClustersByEventId(@Param("eventId") String eventId);
}
