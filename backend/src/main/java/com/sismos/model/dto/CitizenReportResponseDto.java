package com.sismos.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CitizenReportResponseDto {
    private UUID id;
    private String eventId;
    private Instant reportedAt;
    private Short perceivedIntensity;
    private String emojiTag;
    private Double latitude;
    private Double longitude;
    private Double distanceToEpicenterMeters;
    private Double maxPerceptibleRadiusMeters;
    private String message;
}
