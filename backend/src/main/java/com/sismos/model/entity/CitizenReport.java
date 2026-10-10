package com.sismos.model.entity;

import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Point;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "citizen_reports")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CitizenReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "event_id", length = 64)
    private String eventId;

    @Column(name = "reported_at", nullable = false)
    @Builder.Default
    private Instant reportedAt = Instant.now();

    @Column(name = "perceived_intensity", nullable = false)
    private Short perceivedIntensity;

    @Column(name = "emoji_tag", length = 32)
    private String emojiTag;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(nullable = false, columnDefinition = "geometry(Point, 4326)")
    private Point geom;

    @Column(name = "client_fingerprint", length = 64)
    private String clientFingerprint;

    public Double getLongitude() {
        return geom != null ? geom.getX() : null;
    }

    public Double getLatitude() {
        return geom != null ? geom.getY() : null;
    }
}
