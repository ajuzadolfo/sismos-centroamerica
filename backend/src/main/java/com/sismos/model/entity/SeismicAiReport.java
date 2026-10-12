package com.sismos.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "seismic_ai_reports")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeismicAiReport {

    @Id
    @Column(name = "event_id", length = 64)
    private String eventId;

    @Column(name = "model_used", nullable = false, length = 64)
    private String modelUsed;

    @Column(name = "executive_summary", nullable = false, columnDefinition = "TEXT")
    private String executiveSummary;

    @Column(name = "tectonic_context", nullable = false, columnDefinition = "TEXT")
    private String tectonicContext;

    @Column(name = "tsunami_risk", nullable = false, columnDefinition = "TEXT")
    private String tsunamiRisk;

    @Column(name = "safety_recommendations", nullable = false, columnDefinition = "TEXT")
    private String safetyRecommendations;

    @Column(name = "estimated_peak_intensity", length = 64)
    private String estimatedPeakIntensity;

    @Column(name = "generated_at")
    private Instant generatedAt;
}
