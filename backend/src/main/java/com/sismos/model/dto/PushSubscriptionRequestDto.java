package com.sismos.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PushSubscriptionRequestDto {

    @NotBlank(message = "El endpoint de la suscripción es requerido")
    private String endpoint;

    private Map<String, String> keys;

    private BigDecimal minMagnitude;
}
