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
public class GeoJsonFeatureCollection {

    @Builder.Default
    private String type = "FeatureCollection";
    private List<GeoJsonFeature> features;
}
