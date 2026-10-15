package com.sismos.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sismos.service.RateLimiterService;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);
    private static final String CHAT_PATH_PREFIX = "/api/v1/chat";

    private final RateLimiterService rateLimiterService;
    private final ObjectMapper objectMapper;

    public RateLimitFilter(RateLimiterService rateLimiterService, ObjectMapper objectMapper) {
        this.rateLimiterService = rateLimiterService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Ignorar peticiones CORS OPTIONS y endpoints fuera de /api/v1/chat
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return path == null || !path.startsWith(CHAT_PATH_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (!rateLimiterService.isEnabled()) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(request);
        ConsumptionProbe probe = rateLimiterService.tryConsume(clientIp);

        if (probe == null || probe.isConsumed()) {
            if (probe != null) {
                response.setHeader("X-Rate-Limit-Remaining", String.valueOf(probe.getRemainingTokens()));
            }
            filterChain.doFilter(request, response);
            return;
        }

        long waitSeconds = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()));
        log.warn("Rate limit excedido para IP [{}] en URI [{}]. Espera requerida: {}s",
                clientIp, request.getRequestURI(), waitSeconds);

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", String.valueOf(waitSeconds));
        response.setHeader("X-Rate-Limit-Retry-After-Seconds", String.valueOf(waitSeconds));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        Map<String, Object> errorBody = Map.of(
                "status", HttpStatus.TOO_MANY_REQUESTS.value(),
                "error", "Too Many Requests",
                "message", "Has superado el límite de consultas permitidas por minuto. Por favor, espera unos segundos antes de volver a preguntar a Cabrakán AI.",
                "messageEn", "You have exceeded the allowed queries per minute. Please wait a few seconds before asking Cabrakán AI again.",
                "retryAfterSeconds", waitSeconds
        );

        objectMapper.writeValue(response.getWriter(), errorBody);
    }

    /**
     * Resuelve la IP pública real del cliente considerando proxies y balanceadores de Cloud Run.
     */
    public String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            String[] ips = xForwardedFor.split(",");
            if (ips.length > 0 && !ips[0].trim().isBlank()) {
                return ips[0].trim();
            }
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown-ip";
    }
}
