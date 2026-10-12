package com.sismos.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sismos.model.dto.SeismicIntelligenceReportDto;
import com.sismos.model.entity.SeismicAiReport;
import com.sismos.model.entity.SeismicEvent;
import com.sismos.repository.SeismicAiReportRepository;
import com.sismos.repository.SeismicEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeminiIntelligenceService {

    private final SeismicEventRepository seismicEventRepository;
    private final SeismicAiReportRepository seismicAiReportRepository;
    private final ObjectMapper objectMapper;
    private final RestClient restClient = RestClient.builder().build();

    @Value("${gemini.api.key:#{null}}")
    private String geminiApiKey;

    // Caché en memoria para evitar invocar el modelo varias veces para el mismo evento
    private final Map<String, SeismicIntelligenceReportDto> reportCache = new ConcurrentHashMap<>();

    public SeismicIntelligenceReportDto generateReport(String eventId) {
        // 1. Caché L1 en memoria
        if (reportCache.containsKey(eventId)) {
            return reportCache.get(eventId);
        }

        SeismicEvent event = seismicEventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Sismo no encontrado con ID: " + eventId));

        // 2. Caché L2 en PostgreSQL (seismic_ai_reports)
        var existingReport = seismicAiReportRepository.findById(eventId);
        if (existingReport.isPresent()) {
            SeismicAiReport dbEntity = existingReport.get();
            SeismicIntelligenceReportDto cached = SeismicIntelligenceReportDto.builder()
                    .eventId(dbEntity.getEventId())
                    .title(event.getTitle())
                    .modelUsed(dbEntity.getModelUsed())
                    .executiveSummary(dbEntity.getExecutiveSummary())
                    .tectonicContext(dbEntity.getTectonicContext())
                    .tsunamiRiskAssessment(dbEntity.getTsunamiRisk())
                    .safetyRecommendations(deserializeRecommendations(dbEntity.getSafetyRecommendations()))
                    .estimatedPeakIntensity(dbEntity.getEstimatedPeakIntensity())
                    .generatedAt(dbEntity.getGeneratedAt() != null ? dbEntity.getGeneratedAt().toString() : Instant.now().toString())
                    .build();
            reportCache.put(eventId, cached);
            return cached;
        }

        // 3. Generación en vivo (Gemini 2.5 Flash o Fallback geocientífico)
        SeismicIntelligenceReportDto report;
        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            try {
                report = callGeminiApi(event);
            } catch (Exception e) {
                log.warn("Fallo al invocar la API de Gemini 2.5 Flash, usando generador geocientífico de respaldo: {}", e.getMessage());
                report = generateFallbackReport(event);
            }
        } else {
            report = generateFallbackReport(event);
        }

        // 4. Persistir en base de datos para no consumir tokens repetidos
        try {
            SeismicAiReport entityToSave = SeismicAiReport.builder()
                    .eventId(report.getEventId())
                    .modelUsed(report.getModelUsed())
                    .executiveSummary(report.getExecutiveSummary())
                    .tectonicContext(report.getTectonicContext())
                    .tsunamiRisk(report.getTsunamiRiskAssessment())
                    .safetyRecommendations(serializeRecommendations(report.getSafetyRecommendations()))
                    .estimatedPeakIntensity(report.getEstimatedPeakIntensity())
                    .generatedAt(Instant.now())
                    .build();
            seismicAiReportRepository.save(entityToSave);
        } catch (Exception e) {
            log.warn("No se pudo persistir el reporte de IA en base de datos: {}", e.getMessage());
        }

        reportCache.put(eventId, report);
        return report;
    }

    private SeismicIntelligenceReportDto callGeminiApi(SeismicEvent event) {
        String prompt = buildPrompt(event);
        String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiApiKey;

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                ),
                "generationConfig", Map.of(
                        "temperature", 0.2,
                        "maxOutputTokens", 800
                )
        );

        @SuppressWarnings("unchecked")
        Map<String, Object> response = restClient.post()
                .uri(url)
                .header("Content-Type", "application/json")
                .body(requestBody)
                .retrieve()
                .body(Map.class);

        if (response != null && response.containsKey("candidates")) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.get("candidates");
            if (!candidates.isEmpty()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
                if (!parts.isEmpty()) {
                    String rawText = (String) parts.get(0).get("text");
                    return parseAiResponse(event, rawText);
                }
            }
        }

        return generateFallbackReport(event);
    }

    private String buildPrompt(SeismicEvent event) {
        double lat = event.getLatitude() != null ? event.getLatitude() : 0.0;
        double lon = event.getLongitude() != null ? event.getLongitude() : 0.0;
        double depth = event.getDepth() != null ? event.getDepth().doubleValue() : 10.0;
        double mag = event.getMagnitude() != null ? event.getMagnitude().doubleValue() : 4.0;

        return String.format(
                "Eres un sismólogo y geofísico experto en la tectónica de Centroamérica (Fosa Mesoamericana, Placas Cocos y Caribe, fallas Motagua-Polochic). " +
                "Analiza el siguiente evento sísmico ocurrido en la región:\n" +
                "- Título / Lugar: %s\n" +
                "- Coordenadas: %.3f° N, %.3f° O\n" +
                "- Magnitud: %.1f\n" +
                "- Profundidad: %.1f km\n" +
                "- Hora: %s\n\n" +
                "Proporciona un reporte estructurado y profesional con:\n" +
                "1. Resumen ejecutivo del impacto percibido.\n" +
                "2. Contexto tectónico y mecanismo focal más probable (subducción interplaca, intraplaca o falla cortical).\n" +
                "3. Evaluación de riesgo de tsunami.\n" +
                "4. 3 a 4 recomendaciones de seguridad clave para la población civil.",
                event.getTitle(), lat, Math.abs(lon), mag, depth, event.getTime()
        );
    }

    private SeismicIntelligenceReportDto parseAiResponse(SeismicEvent event, String text) {
        return SeismicIntelligenceReportDto.builder()
                .eventId(event.getId())
                .title(event.getTitle())
                .modelUsed("gemini-2.5-flash")
                .executiveSummary(text)
                .tectonicContext(determineTectonicContext(event))
                .tsunamiRiskAssessment(determineTsunamiRisk(event))
                .safetyRecommendations(getStandardRecommendations(event))
                .estimatedPeakIntensity(calculateMmiString(event))
                .generatedAt(Instant.now().toString())
                .build();
    }

    private SeismicIntelligenceReportDto generateFallbackReport(SeismicEvent event) {
        double mag = event.getMagnitude() != null ? event.getMagnitude().doubleValue() : 4.5;
        double depth = event.getDepth() != null ? event.getDepth().doubleValue() : 25.0;
        double lat = event.getLatitude() != null ? event.getLatitude() : 13.5;
        double lon = event.getLongitude() != null ? event.getLongitude() : -88.0;

        String summary;
        if (mag >= 6.5) {
            summary = String.format("Evento sísmico de gran magnitud (M %.1f) a una profundidad de %.1f km. Posee alto potencial de daños estructurales en edificaciones no sismorresistentes cercanas al epicentro y amplia percepción en múltiples países de Centroamérica.", mag, depth);
        } else if (mag >= 5.0) {
            summary = String.format("Sismo moderado-fuerte (M %.1f) registrado a %.1f km de profundidad focal. Sentido con claridad en áreas urbanas circundantes, con probabilidad de caída de objetos ligeros e interrupciones temporales en servicios.", mag, depth);
        } else {
            summary = String.format("Movimiento telúrico menor a moderado (M %.1f) a %.1f km de profundidad. Típico de la constante dinámica geológica centroamericana, perceptible principalmente en pisos altos y en reposo.", mag, depth);
        }

        String model = (geminiApiKey != null && !geminiApiKey.isBlank())
                ? "gemini-2.5-flash-fallback"
                : "geoscientific-rules-engine";

        return SeismicIntelligenceReportDto.builder()
                .eventId(event.getId())
                .title(event.getTitle())
                .modelUsed(model)
                .executiveSummary(summary)
                .tectonicContext(determineTectonicContext(event))
                .tsunamiRiskAssessment(determineTsunamiRisk(event))
                .safetyRecommendations(getStandardRecommendations(event))
                .estimatedPeakIntensity(calculateMmiString(event))
                .generatedAt(Instant.now().toString())
                .build();
    }

    private String determineTectonicContext(SeismicEvent event) {
        double lat = event.getLatitude() != null ? event.getLatitude() : 13.5;
        double lon = event.getLongitude() != null ? event.getLongitude() : -88.0;
        double depth = event.getDepth() != null ? event.getDepth().doubleValue() : 20.0;

        // Zona del Pacífico / Fosa Mesoamericana
        if (lon < -85.0 && lat < 15.0 && lon > -94.0) {
            if (depth < 40) {
                return "Zona de Subducción de la Fosa Mesoamericana (Acoplamiento interplaca entre la Placa de Cocos subduciendo bajo la Placa del Caribe). Mecanismo de falla inversa.";
            } else {
                return "Sismicidad intraplaca en la losa oceánica subducida de la Placa de Cocos a profundidad intermedia. Mecanismo de deformación por extensión/compresión.";
            }
        } else if (lat >= 14.5 && lon > -92.0 && lon < -87.0) {
            return "Zona de Falla Transformante Motagua-Polochic (Límite transcurrente siniestral entre las Placas Norteamericana y del Caribe). Sismicidad somera cortical.";
        } else if (lon >= -85.0 && lon <= -77.0) {
            return "Cinturón Deformado del Norte de Panamá / Fractura de Panamá (Microplaca de Panamá y arco volcánico del sur de Centroamérica).";
        }
        return "Cinturón Volcánico Centroamericano y fallamiento cortical somero local.";
    }

    private String determineTsunamiRisk(SeismicEvent event) {
        double mag = event.getMagnitude() != null ? event.getMagnitude().doubleValue() : 4.0;
        double depth = event.getDepth() != null ? event.getDepth().doubleValue() : 50.0;
        boolean tsunamiFlag = Boolean.TRUE.equals(event.getTsunamiAlert());

        if (tsunamiFlag || (mag >= 7.0 && depth < 35.0)) {
            return "ALERTA / RIESGO ELEVADO: Evento de gran magnitud con foco somero en entorno marítimo. Monitorear de inmediato las alertas del PTWC (Pacific Tsunami Warning Center) y autoridades locales.";
        } else if (mag >= 6.0 && depth < 60.0) {
            return "Riesgo Bajo a Moderado: Se descartan tsunamis destructivos de cuenca, aunque podrían observarse perturbaciones menores del nivel del mar en ensenadas cercanas.";
        } else {
            return "Sin Riesgo de Tsunami: La magnitud y/o profundidad focal no reúnen las condiciones geofísicas para generación de ondas de tsunami.";
        }
    }

    private List<String> getStandardRecommendations(SeismicEvent event) {
        double mag = event.getMagnitude() != null ? event.getMagnitude().doubleValue() : 4.5;
        List<String> list = new ArrayList<>();
        list.add("Mantener la calma y aplicar el protocolo 'Agacharse, Cubrirse y Sujetarse' ante réplicas.");
        list.add("Verificar instalaciones de gas y suministro eléctrico antes de reanudar su uso.");
        if (mag >= 5.5) {
            list.add("Evitar áreas costeras bajas hasta que los boletines oceanográficos descarten fluctuaciones del nivel del mar.");
            list.add("Revisar posibles grietas estructurales o desprendimientos en muros y cornisas.");
        }
        list.add("Informarse exclusivamente por los canales oficiales de Protección Civil y los institutos sismológicos nacionales (INSIVUMEH, MARN, COPECO, INETER, OVSICORI, IGC).");
        return list;
    }

    private String calculateMmiString(SeismicEvent event) {
        double mag = event.getMagnitude() != null ? event.getMagnitude().doubleValue() : 4.5;
        if (mag >= 7.5) return "MMI VIII - IX (Destructivo / Violento)";
        if (mag >= 6.5) return "MMI VII - VIII (Muy Fuerte / Ruinoso)";
        if (mag >= 5.5) return "MMI VI (Fuerte)";
        if (mag >= 4.5) return "MMI V (Moderado)";
        if (mag >= 3.5) return "MMI IV (Ligero)";
        return "MMI II - III (Débil)";
    }

    private String serializeRecommendations(List<String> list) {
        if (list == null || list.isEmpty()) return "[]";
        try {
            return objectMapper.writeValueAsString(list);
        } catch (Exception e) {
            return String.join("||", list);
        }
    }

    private List<String> deserializeRecommendations(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of(json.split("\\|\\|"));
        }
    }
}
