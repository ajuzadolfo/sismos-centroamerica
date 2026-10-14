package com.sismos.analytics;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ReasenbergJonesForecasterTest {

    @Test
    @DisplayName("Mm=7.7, M>=5.0 entre día 1 y 2 debe dar N ~ 3.97 y P ~ 0.981")
    void testMainshock77M5() {
        double n = ReasenbergJonesForecaster.expectedCount(7.7, 5.0, 1.0, 2.0);
        double p = ReasenbergJonesForecaster.probabilityAtLeastOne(n);

        // Tolerancia +- 2% sobre N ~ 3.97
        assertTrue(n >= 3.85 && n <= 4.10, "N esperado debe ser ~3.97, obtenido: " + n);
        assertTrue(p >= 0.975 && p <= 0.988, "P esperada debe ser ~0.981, obtenida: " + p);
    }

    @Test
    @DisplayName("Mm=7.7, M>=4.0 entre día 1 y 2 debe dar N ~ 32.3 y P ~ 1.000")
    void testMainshock77M4() {
        double n = ReasenbergJonesForecaster.expectedCount(7.7, 4.0, 1.0, 2.0);
        double p = ReasenbergJonesForecaster.probabilityAtLeastOne(n);

        // Tolerancia +- 2% sobre N ~ 32.3
        assertTrue(n >= 31.5 && n <= 33.2, "N esperado debe ser ~32.3, obtenido: " + n);
        assertTrue(p >= 0.999 && p <= 1.0, "P esperada debe ser ~1.000, obtenida: " + p);
    }

    @Test
    @DisplayName("Mm=6.0, M>=4.0 entre día 0 y 1 debe dar N ~ 4.85 y P ~ 0.992")
    void testMainshock60M4() {
        double n = ReasenbergJonesForecaster.expectedCount(6.0, 4.0, 0.0, 1.0);
        double p = ReasenbergJonesForecaster.probabilityAtLeastOne(n);

        // Tolerancia +- 2% sobre N ~ 4.85
        assertTrue(n >= 4.70 && n <= 5.00, "N esperado debe ser ~4.85, obtenido: " + n);
        assertTrue(p >= 0.988 && p <= 0.995, "P esperada debe ser ~0.992, obtenida: " + p);
    }

    @Test
    @DisplayName("N decrece monótonamente al aumentar t1 con ventana fija")
    void testDecayOverTime() {
        double nDay1To2 = ReasenbergJonesForecaster.expectedCount(7.0, 5.0, 1.0, 2.0);
        double nDay2To3 = ReasenbergJonesForecaster.expectedCount(7.0, 5.0, 2.0, 3.0);
        double nDay3To4 = ReasenbergJonesForecaster.expectedCount(7.0, 5.0, 3.0, 4.0);

        assertTrue(nDay1To2 > nDay2To3, "El conteo en día 1-2 debe ser mayor que día 2-3");
        assertTrue(nDay2To3 > nDay3To4, "El conteo en día 2-3 debe ser mayor que día 3-4");
    }

    @Test
    @DisplayName("N acumulado crece con ventanas más amplias (24h < 48h < 72h)")
    void testCumulativeWindows() {
        double t0 = 0.5;
        double n24h = ReasenbergJonesForecaster.expectedCount(7.0, 5.0, t0, t0 + 1.0);
        double n48h = ReasenbergJonesForecaster.expectedCount(7.0, 5.0, t0, t0 + 2.0);
        double n72h = ReasenbergJonesForecaster.expectedCount(7.0, 5.0, t0, t0 + 3.0);

        assertTrue(n24h < n48h, "Ventana de 24h debe ser menor que 48h");
        assertTrue(n48h < n72h, "Ventana de 48h debe ser menor que 72h");
    }
}
