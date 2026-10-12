package com.sismos.repository;

import com.sismos.model.entity.SeismicAiReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SeismicAiReportRepository extends JpaRepository<SeismicAiReport, String> {
}
