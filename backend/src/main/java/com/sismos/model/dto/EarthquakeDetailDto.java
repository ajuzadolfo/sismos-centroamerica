package com.sismos.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EarthquakeDetailDto {
    private String id;
    private String title;
    private String place;
    private Instant time;
    private Instant updatedAt;
    private BigDecimal magnitude;
    private String magnitudeType;
    private BigDecimal depth;
    private String status;
    private String alertLevel;
    private Integer significance;
    private Boolean tsunamiAlert;
    private Double latitude;
    private Double longitude;

    // Métricas comunitarias de sismología ciudadana
    private long totalCitizenReports;
    private Double averagePerceivedIntensity;
    private List<Object[]> intensityClusters;
}
