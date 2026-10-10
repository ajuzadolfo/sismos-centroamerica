package com.sismos.model.dto.usgs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class UsgsFeatureCollection {
    private String type;
    private List<UsgsFeature> features;
}
