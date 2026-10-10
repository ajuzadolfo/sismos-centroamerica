package com.sismos.mapper;

import com.sismos.model.dto.GeoJsonFeature;
import com.sismos.model.dto.GeoJsonFeatureCollection;
import com.sismos.model.dto.GeoJsonGeometry;
import com.sismos.model.entity.SeismicEvent;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class GeoJsonMapper {

    public GeoJsonFeature toFeature(SeismicEvent event) {
        if (event == null) {
            return null;
        }

        List<Double> coords = new ArrayList<>();
        if (event.getGeom() != null) {
            coords.add(event.getGeom().getX()); // Longitud
            coords.add(event.getGeom().getY()); // Latitud
            if (event.getDepth() != null) {
                coords.add(event.getDepth().doubleValue()); // Profundidad (km)
            }
        }

        Map<String, Object> props = new LinkedHashMap<>();
        props.put("title", event.getTitle());
        props.put("place", event.getPlace());
        props.put("magnitude", event.getMagnitude());
        props.put("magnitudeType", event.getMagnitudeType());
        props.put("depth", event.getDepth());
        props.put("time", event.getTime() != null ? event.getTime().toString() : null);
        props.put("updatedAt", event.getUpdatedAt() != null ? event.getUpdatedAt().toString() : null);
        props.put("status", event.getStatus());
        props.put("alertLevel", event.getAlertLevel());
        props.put("significance", event.getSignificance());
        props.put("tsunamiAlert", Boolean.TRUE.equals(event.getTsunamiAlert()));

        return GeoJsonFeature.builder()
                .type("Feature")
                .id(event.getId())
                .geometry(GeoJsonGeometry.builder()
                        .type("Point")
                        .coordinates(coords)
                        .build())
                .properties(props)
                .build();
    }

    public GeoJsonFeatureCollection toFeatureCollection(List<SeismicEvent> events) {
        if (events == null) {
            return GeoJsonFeatureCollection.builder().features(Collections.emptyList()).build();
        }

        List<GeoJsonFeature> features = events.stream()
                .map(this::toFeature)
                .filter(Objects::nonNull)
                .toList();

        return GeoJsonFeatureCollection.builder()
                .type("FeatureCollection")
                .features(features)
                .build();
    }
}
