package com.sismos.analytics;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.*;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.*;

@Slf4j
@Component
public class CountryBoundaryClassifier {

    public record ClassificationResult(
            String iso2,
            String countryLabel,
            boolean isOffshore,
            boolean isWithinCentralAmerica
    ) {}

    private record CountryEntry(
            String iso2,
            String nameEs,
            Geometry geometry
    ) {}

    private final List<CountryEntry> countries = new ArrayList<>();
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);
    private static final Set<String> EXTERNAL_ISOS = Set.of("MX", "BZ", "CO");
    private static final double MAX_OFFSHORE_DISTANCE_KM = 100.0;

    @PostConstruct
    public void init() {
        try {
            var resolver = new PathMatchingResourcePatternResolver();
            Resource resource = resolver.getResource("classpath:geo/central_america_admin0.geojson");
            if (!resource.exists()) {
                log.warn("central_america_admin0.geojson not found on classpath");
                return;
            }

            ObjectMapper mapper = new ObjectMapper();
            try (InputStream is = resource.getInputStream()) {
                JsonNode root = mapper.readTree(is);
                JsonNode features = root.path("features");
                for (JsonNode f : features) {
                    String iso2 = f.path("properties").path("iso2").asText();
                    String nameEs = f.path("properties").path("name_es").asText();
                    Geometry geom = parseMultiPolygon(f.path("geometry"));
                    if (geom != null) {
                        countries.add(new CountryEntry(iso2, nameEs, geom));
                    }
                }
            }
            log.info("CountryBoundaryClassifier initialized with {} country boundaries", countries.size());
        } catch (Exception e) {
            log.error("Failed to initialize CountryBoundaryClassifier: {}", e.getMessage(), e);
        }
    }

    public ClassificationResult classify(double lat, double lon) {
        Point point = geometryFactory.createPoint(new Coordinate(lon, lat));

        // 1. In-land containment check
        for (CountryEntry entry : countries) {
            if (entry.geometry().contains(point) || entry.geometry().covers(point)) {
                boolean external = EXTERNAL_ISOS.contains(entry.iso2());
                String label = external ? "Fuera de Centroamérica" : entry.nameEs();
                return new ClassificationResult(entry.iso2(), label, false, !external);
            }
        }

        // 2. Offshore check within 100 km (find closest country)
        CountryEntry closest = null;
        double minDistanceKm = Double.MAX_VALUE;

        for (CountryEntry entry : countries) {
            double distKm = computeApproxDistanceKm(entry.geometry(), point, lat);
            if (distKm < minDistanceKm) {
                minDistanceKm = distKm;
                closest = entry;
            }
        }

        if (closest != null && minDistanceKm <= MAX_OFFSHORE_DISTANCE_KM) {
            boolean external = EXTERNAL_ISOS.contains(closest.iso2());
            String label = external ? "Fuera de Centroamérica" : closest.nameEs();
            return new ClassificationResult(closest.iso2(), label, true, !external);
        }

        // 3. Deep ocean / outside 100 km
        return new ClassificationResult("OC", "Otros / Océano", true, false);
    }

    private Geometry parseMultiPolygon(JsonNode geomNode) {
        String type = geomNode.path("type").asText();
        JsonNode coords = geomNode.path("coordinates");
        if (!coords.isArray() || coords.isEmpty()) return null;

        if ("Polygon".equalsIgnoreCase(type)) {
            Polygon poly = parseSinglePolygon(coords);
            return poly != null ? geometryFactory.createMultiPolygon(new Polygon[]{poly}) : null;
        } else if ("MultiPolygon".equalsIgnoreCase(type)) {
            // Soporta tanto GeoJSON con coordenadas de 3 niveles [[[lon, lat], ...]]
            // como formato estándar de 4 niveles [[[[lon, lat], ...]]]]
            JsonNode first = coords.get(0);
            if (first.isArray() && !first.isEmpty()) {
                JsonNode second = first.get(0);
                if (second.isArray() && !second.isEmpty() && second.get(0).isNumber()) {
                    Polygon poly = parseSinglePolygon(coords);
                    return poly != null ? geometryFactory.createMultiPolygon(new Polygon[]{poly}) : null;
                }
            }

            List<Polygon> polys = new ArrayList<>();
            for (JsonNode polyCoords : coords) {
                Polygon p = parseSinglePolygon(polyCoords);
                if (p != null) polys.add(p);
            }
            return polys.isEmpty() ? null : geometryFactory.createMultiPolygon(polys.toArray(new Polygon[0]));
        }
        return null;
    }

    private Polygon parseSinglePolygon(JsonNode polyCoords) {
        if (!polyCoords.isArray() || polyCoords.isEmpty()) return null;
        LinearRing exterior = parseLinearRing(polyCoords.get(0));
        if (exterior == null) return null;

        List<LinearRing> holes = new ArrayList<>();
        for (int i = 1; i < polyCoords.size(); i++) {
            LinearRing hole = parseLinearRing(polyCoords.get(i));
            if (hole != null) holes.add(hole);
        }
        return geometryFactory.createPolygon(exterior, holes.toArray(new LinearRing[0]));
    }

    private LinearRing parseLinearRing(JsonNode ringCoords) {
        List<Coordinate> coords = new ArrayList<>();
        for (JsonNode pt : ringCoords) {
            coords.add(new Coordinate(pt.get(0).asDouble(), pt.get(1).asDouble()));
        }
        if (coords.size() < 4) return null;
        // Ensure closed ring
        if (!coords.get(0).equals2D(coords.get(coords.size() - 1))) {
            coords.add(new Coordinate(coords.get(0).x, coords.get(0).y));
        }
        return geometryFactory.createLinearRing(coords.toArray(new Coordinate[0]));
    }

    private double computeApproxDistanceKm(Geometry geom, Point point, double lat) {
        // Approximate distance in degrees
        double degDist = geom.distance(point);
        // At equator 1 deg ~ 111 km, at given latitude:
        double latKmPerDeg = 111.0;
        double lonKmPerDeg = 111.0 * Math.cos(Math.toRadians(lat));
        double avgKmPerDeg = (latKmPerDeg + lonKmPerDeg) / 2.0;
        return degDist * avgKmPerDeg;
    }
}
