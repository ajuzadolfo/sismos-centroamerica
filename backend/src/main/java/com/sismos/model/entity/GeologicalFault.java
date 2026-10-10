package com.sismos.model.entity;

import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Geometry;

@Entity
@Table(name = "geological_faults")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GeologicalFault {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "fault_type", length = 50)
    private String faultType;

    @Column(name = "country_code", length = 3)
    private String countryCode;

    @Column(nullable = false, columnDefinition = "geometry(MultiLineString, 4326)")
    private Geometry geom;
}
