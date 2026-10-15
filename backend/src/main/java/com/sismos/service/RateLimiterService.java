package com.sismos.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Service
public class RateLimiterService {

    private static final Logger log = LoggerFactory.getLogger(RateLimiterService.class);

    private final boolean enabled;
    private final long capacity;
    private final long refillTokens;
    private final long refillDurationMinutes;

    // Cache de buckets con desalojo automático por inactividad (evita fugas de memoria con millones de IPs)
    private final Cache<String, Bucket> bucketCache;

    public RateLimiterService(
            @Value("${cabrakan.rate-limit.enabled:true}") boolean enabled,
            @Value("${cabrakan.rate-limit.capacity:10}") long capacity,
            @Value("${cabrakan.rate-limit.refill-tokens:10}") long refillTokens,
            @Value("${cabrakan.rate-limit.refill-duration-minutes:1}") long refillDurationMinutes) {
        this.enabled = enabled;
        this.capacity = capacity;
        this.refillTokens = refillTokens;
        this.refillDurationMinutes = refillDurationMinutes;
        this.bucketCache = Caffeine.newBuilder()
                .maximumSize(10_000)
                .expireAfterAccess(10, TimeUnit.MINUTES)
                .build();
        log.info("RateLimiterService inicializado [enabled={}, capacity={}, refillTokens={}, refillDurationMinutes={}m]",
                enabled, capacity, refillTokens, refillDurationMinutes);
    }

    public ConsumptionProbe tryConsume(String clientKey) {
        if (!enabled) {
            // Si está deshabilitado, simula consumo exitoso infinito
            return null;
        }

        Bucket bucket = bucketCache.get(clientKey, this::createNewBucket);
        return bucket.tryConsumeAndReturnRemaining(1);
    }

    public boolean isEnabled() {
        return enabled;
    }

    private Bucket createNewBucket(String key) {
        Bandwidth limit = Bandwidth.builder()
                .capacity(capacity)
                .refillGreedy(refillTokens, Duration.ofMinutes(refillDurationMinutes))
                .build();
        return Bucket.builder()
                .addLimit(limit)
                .build();
    }
}
