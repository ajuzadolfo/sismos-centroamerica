package com.sismos.model.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CitizenReportRequestDto {

    @NotNull(message = "La intensidad percibida es obligatoria")
    @Min(value = 1, message = "La intensidad mínima es 1 (Leve)")
    @Max(value = 5, message = "La intensidad máxima es 5 (Extremo/Daños)")
    private Short perceivedIntensity;

    private String emojiTag;

    private String comment;

    @NotNull(message = "La latitud es obligatoria")
    private Double latitude;

    @NotNull(message = "La longitud es obligatoria")
    private Double longitude;

    private String clientFingerprint;
}
