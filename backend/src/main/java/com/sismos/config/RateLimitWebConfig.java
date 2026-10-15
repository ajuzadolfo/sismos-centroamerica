package com.sismos.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sismos.security.RateLimitFilter;
import com.sismos.service.RateLimiterService;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RateLimitWebConfig {

    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(
            RateLimiterService rateLimiterService,
            ObjectMapper objectMapper) {
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new RateLimitFilter(rateLimiterService, objectMapper));
        registration.addUrlPatterns("/api/v1/chat/*");
        registration.setOrder(1);
        return registration;
    }
}
