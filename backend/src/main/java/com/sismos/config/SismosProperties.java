package com.sismos.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "sismos")
public class SismosProperties {

    private RegionProperties region = new RegionProperties();
    private IngestionProperties ingestion = new IngestionProperties();

    @Data
    public static class RegionProperties {
        private double minLatitude = 7.0;
        private double maxLatitude = 18.5;
        private double minLongitude = -93.0;
        private double maxLongitude = -77.0;
    }

    @Data
    public static class IngestionProperties {
        private long cronRateMs = 60000;
        private String usgsCdnUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
        private String usgsFdsnBaseUrl = "https://earthquake.usgs.gov/fdsnws/event/1/query";
    }
}
