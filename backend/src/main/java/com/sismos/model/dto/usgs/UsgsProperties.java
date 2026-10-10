package com.sismos.model.dto.usgs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.math.BigDecimal;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class UsgsProperties {
    private BigDecimal mag;
    private String place;
    private Long time;
    private Long updated;
    private String status;
    private Integer tsunami;
    private Integer sig;
    private String alert;
    private String magType;
    private String title;
}
