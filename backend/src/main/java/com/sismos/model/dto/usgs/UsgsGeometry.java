package com.sismos.model.dto.usgs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class UsgsGeometry {
    private String type;
    /**
     * Coordenadas GeoJSON de USGS: [longitud, latitud, profundidad_en_km]
     */
    private List<Double> coordinates;
}
