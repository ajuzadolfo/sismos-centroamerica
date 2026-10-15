package com.sismos.model.dto;

public record ClientErrorDto(
        String message,
        String stack,
        String url,
        String userAgent,
        String errorType,
        String timestamp
) {}
