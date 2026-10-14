package com.sismos.analytics;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CountryBoundaryClassifierTest {

    private CountryBoundaryClassifier classifier;

    @BeforeEach
    void setUp() {
        classifier = new CountryBoundaryClassifier();
        classifier.init();
    }

    @Test
    @DisplayName("Sismo en Tapachula (14.9, -92.3) se clasifica como Fuera de Centroamérica (México)")
    void shouldClassifyTapachulaAsOutsideCentralAmerica() {
        var result = classifier.classify(14.9, -92.3);
        assertEquals("MX", result.iso2());
        assertEquals("Fuera de Centroamérica", result.countryLabel());
        assertFalse(result.isWithinCentralAmerica());
    }

    @Test
    @DisplayName("Sismo en Estelí (13.1, -86.35) se clasifica como Nicaragua (in-land)")
    void shouldClassifyEsteliAsNicaragua() {
        var result = classifier.classify(13.1, -86.35);
        assertEquals("NI", result.iso2());
        assertEquals("Nicaragua", result.countryLabel());
        assertFalse(result.isOffshore());
        assertTrue(result.isWithinCentralAmerica());
    }

    @Test
    @DisplayName("Sismo a ~50 km de la costa de Osa (8.3, -84.0) se clasifica como Costa Rica (offshore <= 100 km)")
    void shouldClassifyOsaCoastAsCostaRicaOffshore() {
        var result = classifier.classify(8.3, -84.0);
        assertEquals("CR", result.iso2());
        assertEquals("Costa Rica", result.countryLabel());
        assertTrue(result.isOffshore());
        assertTrue(result.isWithinCentralAmerica());
    }

    @Test
    @DisplayName("Sismo en fosa oceánica profunda (> 100 km de la costa) se clasifica como Otros / Océano")
    void shouldClassifyDeepOceanAsOffshoreOcean() {
        var result = classifier.classify(9.0, -90.0);
        assertEquals("OC", result.iso2());
        assertEquals("Otros / Océano", result.countryLabel());
        assertTrue(result.isOffshore());
        assertFalse(result.isWithinCentralAmerica());
    }
}
