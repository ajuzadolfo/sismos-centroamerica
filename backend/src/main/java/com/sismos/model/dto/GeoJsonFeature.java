package com.sismos.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GeoJsonFeature {

    @Builder.Default
    private String type = "Feature";
    private String id;
    private GeoJsonGeometry geometry;
    private Map<String, Object> properties;
}
