package com.sismos.model.dto.usgs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class UsgsFeature {
    private String type;
    private String id;
    private UsgsProperties properties;
    private UsgsGeometry geometry;
}
