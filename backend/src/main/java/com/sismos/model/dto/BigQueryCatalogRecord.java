package com.sismos.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BigQueryCatalogRecord {

    @JsonProperty("event_id")
    private String eventId;

    @JsonProperty("title")
    private String title;

    @JsonProperty("place")
    private String place;

    @JsonProperty("magnitude")
    private BigDecimal magnitude;

    @JsonProperty("magnitude_type")
    private String magnitudeType;

    @JsonProperty("depth_km")
    private BigDecimal depthKm;

    @JsonProperty("event_time")
    private String eventTime;

    @JsonProperty("updated_time")
    private String updatedTime;

    @JsonProperty("status")
    private String status;

    @JsonProperty("tsunami_flag")
    private Boolean tsunamiFlag;

    @JsonProperty("significance")
    private Integer significance;

    @JsonProperty("latitude")
    private Double latitude;

    @JsonProperty("longitude")
    private Double longitude;

    @JsonProperty("country_code")
    private String countryCode;

    @JsonProperty("ingested_at")
    private String ingestedAt;
}
