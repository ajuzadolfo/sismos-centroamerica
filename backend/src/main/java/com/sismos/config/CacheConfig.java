package com.sismos.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.List;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        SimpleCacheManager cacheManager = new SimpleCacheManager();
        cacheManager.setCaches(List.of(
                new CaffeineCache("historicalSummary",
                        Caffeine.newBuilder().expireAfterWrite(Duration.ofHours(1)).maximumSize(50).build()),
                new CaffeineCache("recentSummary",
                        Caffeine.newBuilder().expireAfterWrite(Duration.ofSeconds(60)).maximumSize(50).build()),
                new CaffeineCache("aftershockForecast",
                        Caffeine.newBuilder().expireAfterWrite(Duration.ofMinutes(5)).maximumSize(50).build()),
                new CaffeineCache("historicalInsights",
                        Caffeine.newBuilder().expireAfterWrite(Duration.ofHours(1)).maximumSize(50).build())
        ));
        return cacheManager;
    }
}
