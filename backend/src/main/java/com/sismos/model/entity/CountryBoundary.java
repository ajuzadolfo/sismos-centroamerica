package com.sismos.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;
import org.locationtech.jts.geom.Geometry;

@Entity
@Table(name = "country_boundaries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CountryBoundary {

    @Id
    @Column(length = 2)
    private String iso2;

    @Column(name = "name_es", nullable = false, length = 100)
    private String nameEs;

    @Column(nullable = false, columnDefinition = "geometry(MultiPolygon, 4326)")
    private Geometry geom;
}
