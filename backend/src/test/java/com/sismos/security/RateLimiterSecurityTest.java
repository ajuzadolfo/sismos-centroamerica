package com.sismos.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sismos.service.RateLimiterService;
import io.github.bucket4j.ConsumptionProbe;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class RateLimiterSecurityTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("Debe permitir solicitudes dentro del límite de capacidad y rechazar la siguiente con 429")
    void testRateLimitEnforcement() throws Exception {
        // Creamos un servicio con capacidad de 3 tokens por minuto para pruebas
        RateLimiterService rateLimiterService = new RateLimiterService(true, 3, 3, 1);
        RateLimitFilter filter = new RateLimitFilter(rateLimiterService, objectMapper);

        String ip = "192.168.1.100";

        // Consumir los 3 tokens permitidos
        for (int i = 0; i < 3; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/chat/cabrakan");
            request.addHeader("X-Forwarded-For", ip);
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();

            filter.doFilter(request, response, chain);

            assertEquals(200, response.getStatus());
            assertNotNull(response.getHeader("X-Rate-Limit-Remaining"));
        }

        // El 4to request debe ser rechazado inmediatamente con HTTP 429
        MockHttpServletRequest blockedRequest = new MockHttpServletRequest("POST", "/api/v1/chat/cabrakan");
        blockedRequest.addHeader("X-Forwarded-For", ip);
        MockHttpServletResponse blockedResponse = new MockHttpServletResponse();
        MockFilterChain blockedChain = new MockFilterChain();

        filter.doFilter(blockedRequest, blockedResponse, blockedChain);

        assertEquals(429, blockedResponse.getStatus());
        assertNotNull(blockedResponse.getHeader("Retry-After"));
        assertTrue(blockedResponse.getContentAsString().contains("Too Many Requests"));
        assertTrue(blockedResponse.getContentAsString().contains("Cabrakán AI"));
    }

    @Test
    @DisplayName("Diferentes IPs deben tener cubos independientes (no bloquear a usuarios distintos)")
    void testIndependentBucketsPerIp() {
        RateLimiterService rateLimiterService = new RateLimiterService(true, 2, 2, 1);

        String ipA = "10.0.0.1";
        String ipB = "10.0.0.2";

        // Agotar IP A
        assertTrue(rateLimiterService.tryConsume(ipA).isConsumed());
        assertTrue(rateLimiterService.tryConsume(ipA).isConsumed());
        assertFalse(rateLimiterService.tryConsume(ipA).isConsumed());

        // IP B aún debe tener tokens disponibles
        ConsumptionProbe probeB = rateLimiterService.tryConsume(ipB);
        assertTrue(probeB.isConsumed());
        assertEquals(1, probeB.getRemainingTokens());
    }

    @Test
    @DisplayName("Debe resolver correctamente la IP real desde X-Forwarded-For múltiple")
    void testResolveClientIp() {
        RateLimiterService rateLimiterService = new RateLimiterService(true, 10, 10, 1);
        RateLimitFilter filter = new RateLimitFilter(rateLimiterService, objectMapper);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "203.0.113.195, 70.41.3.18, 150.172.238.178");

        String resolvedIp = filter.resolveClientIp(request);
        assertEquals("203.0.113.195", resolvedIp);
    }

    @Test
    @DisplayName("Peticiones fuera de /api/v1/chat no deben ser filtradas")
    void testNonChatEndpointsNotFiltered() throws Exception {
        RateLimiterService rateLimiterService = new RateLimiterService(true, 0, 0, 1); // 0 capacidad
        RateLimitFilter filter = new RateLimitFilter(rateLimiterService, objectMapper);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/sismos");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus()); // No debe bloquear /api/v1/sismos
    }
}
