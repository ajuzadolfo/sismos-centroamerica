package com.sismos.model.entity;

import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Point;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "seismic_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeismicEvent {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false)
    private String title;

    private String place;

    @Column(nullable = false)
    private Instant time;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(nullable = false, precision = 3, scale = 1)
    private BigDecimal magnitude;

    @Column(name = "magnitude_type", length = 10)
    private String magnitudeType;

    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal depth;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "alert_level", length = 10)
    private String alertLevel;

    private Integer significance;

    @Column(name = "tsunami_alert")
    private Boolean tsunamiAlert;

    @Column(nullable = false, columnDefinition = "geometry(Point, 4326)")
    private Point geom;

    public Double getLongitude() {
        return geom != null ? geom.getX() : null;
    }

    public Double getLatitude() {
        return geom != null ? geom.getY() : null;
    }

    public Point getGeometry() {
        return geom;
    }
}
