package com.sismos.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SeismicIntelligenceReportDto {
    private String eventId;
    private String title;
    private String modelUsed;
    private String executiveSummary;
    private String tectonicContext;
    private String tsunamiRiskAssessment;
    private List<String> safetyRecommendations;
    private String estimatedPeakIntensity;
    private String generatedAt;
}
