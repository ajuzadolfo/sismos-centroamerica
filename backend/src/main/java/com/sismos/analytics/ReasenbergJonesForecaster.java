package com.sismos.analytics;

/**
 * Modelo de Pronóstico de Réplicas según la formulación estándar de Reasenberg y Jones (1989).
 *
 * Tasa de réplicas esperadas de magnitud >= M en el tiempo t (días tras el sismo principal):
 *   lambda(t, M) = 10^(a + b*(Mm - M)) * (t + c)^(-p)
 *
 * Integración sobre una ventana temporal [t1, t2] (para p != 1):
 *   N(t1, t2, M) = 10^(a + b*(Mm - M)) * ((t1 + c)^(1 - p) - (t2 + c)^(1 - p)) / (p - 1)
 *
 * Probabilidad de ocurrencia de al menos una réplica >= M:
 *   P = 1 - exp(-N)
 *
 * Referencia:
 * Reasenberg, P. A., & Jones, L. M. (1989). Earthquake hazard after a mainshock in California.
 * Science, 243(4895), 1173-1176.
 *
 * Parámetros genéricos globales (no calibrados a nivel local):
 * a = -1.67, b = 0.91, p = 1.08, c = 0.05 días.
 */
public final class ReasenbergJonesForecaster {

    public static final double PARAM_A = -1.67;
    public static final double PARAM_B = 0.91;
    public static final double PARAM_P = 1.08;
    public static final double PARAM_C = 0.05; // en días

    private ReasenbergJonesForecaster() {
        // Clase de utilidades matemáticas pura
    }

    /**
     * Calcula el número esperado de réplicas de magnitud >= minMag en el intervalo [t1Days, t2Days].
     *
     * @param mainMag Magnitud del sismo principal (Mm)
     * @param minMag Magnitud umbral de réplicas (M)
     * @param t1Days Días transcurridos desde el sismo principal al inicio de la ventana
     * @param t2Days Días transcurridos desde el sismo principal al fin de la ventana
     * @return Conteo esperado acumulado N
     */
    public static double expectedCount(double mainMag, double minMag, double t1Days, double t2Days) {
        if (t2Days <= t1Days) {
            return 0.0;
        }
        double productivity = Math.pow(10.0, PARAM_A + PARAM_B * (mainMag - minMag));
        double integral = (Math.pow(t1Days + PARAM_C, 1.0 - PARAM_P) - Math.pow(t2Days + PARAM_C, 1.0 - PARAM_P)) / (PARAM_P - 1.0);
        return Math.max(0.0, productivity * integral);
    }

    /**
     * Calcula la probabilidad de Poisson de que ocurra al menos una réplica (P = 1 - e^-N).
     *
     * @param expected Conteo esperado N
     * @return Probabilidad entre 0.0 y 1.0
     */
    public static double probabilityAtLeastOne(double expected) {
        if (expected <= 0.0) {
            return 0.0;
        }
        return Math.min(1.0, Math.max(0.0, 1.0 - Math.exp(-expected)));
    }
}
