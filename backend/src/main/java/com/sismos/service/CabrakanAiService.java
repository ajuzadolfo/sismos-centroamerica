package com.sismos.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sismos.model.dto.CabrakanChatRequest;
import com.sismos.model.dto.CabrakanChatResponse;
import com.sismos.model.entity.SeismicEvent;
import com.sismos.repository.SeismicEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class CabrakanAiService {

    private final SeismicEventRepository seismicEventRepository;
    private final PostGisAnalyticsService postGisAnalyticsService;
    private final Optional<BigQueryAnalyticsService> bigQueryAnalyticsService;
    private final ObjectMapper objectMapper;
    private final RestClient restClient = RestClient.builder().build();

    @Value("${gemini.api.key:#{null}}")
    private String geminiApiKey;

    @Value("${gemini.api.model:gemini-flash-latest}")
    private String geminiModel;

    public CabrakanChatResponse chat(CabrakanChatRequest request) {
        String userMessage = request.getMessage() != null ? request.getMessage().trim() : "";
        if (userMessage.isEmpty()) {
            return CabrakanChatResponse.builder()
                    .reply("Hola, soy **Cabrakán AI**, tu asistente geocientífico para Centroamérica. ¿En qué puedo orientarte hoy sobre la actividad sísmica y tectónica de la región?")
                    .modelUsed((geminiModel != null && !geminiModel.isBlank()) ? geminiModel.trim() : "gemini-3.8-flash")
                    .timestamp(Instant.now().toString())
                    .suggestedQuestions(List.of(
                            "¿Cuáles son los sismos más fuertes registrados?",
                            "¿Cómo interactúan las placas de Cocos y el Caribe?",
                            "¿Qué hacer durante una secuencia de réplicas?"
                    ))
                    .build();
        }

        // 1. Detección de acciones cartográficas (Map Driver)
        Map<String, Object> mapAction = detectMapAction(userMessage);

        // 2. Invocar Gemini 2.5 Flash si la API key está disponible
        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            try {
                return callGeminiChat(request, mapAction);
            } catch (Exception e) {
                log.warn("Fallo en inferencia con Gemini 2.5 Flash, usando respuesta inteligente de respaldo: {}", e.getMessage());
            }
        }

        // 3. Fallback inteligente con conocimiento geodinámico regional
        return generateExpertFallback(userMessage, mapAction);
    }

    private Map<String, Object> detectMapAction(String message) {
        String lower = message.toLowerCase(Locale.ROOT);
        Map<String, Object> action = new HashMap<>();

        if (lower.contains("guatemala") || lower.contains("motagua") || lower.contains("polochic")) {
            action.put("type", "flyTo");
            action.put("lat", 14.63);
            action.put("lon", -90.51);
            action.put("zoom", 7.2);
            action.put("pitch", 40);
        } else if (lower.contains("el salvador") || lower.contains("san salvador") || lower.contains("ilopango")) {
            action.put("type", "flyTo");
            action.put("lat", 13.69);
            action.put("lon", -89.21);
            action.put("zoom", 7.5);
            action.put("pitch", 45);
        } else if (lower.contains("nicaragua") || lower.contains("managua") || lower.contains("momotombo")) {
            action.put("type", "flyTo");
            action.put("lat", 12.13);
            action.put("lon", -86.25);
            action.put("zoom", 7.3);
            action.put("pitch", 45);
        } else if (lower.contains("costa rica") || lower.contains("nicoya") || lower.contains("san josé") || lower.contains("puntarenas")) {
            action.put("type", "flyTo");
            action.put("lat", 9.92);
            action.put("lon", -84.08);
            action.put("zoom", 7.4);
            action.put("pitch", 45);
        } else if (lower.contains("panamá") || lower.contains("panama") || lower.contains("chiriquí") || lower.contains("coiba")) {
            action.put("type", "flyTo");
            action.put("lat", 8.53);
            action.put("lon", -80.78);
            action.put("zoom", 7.1);
            action.put("pitch", 40);
        } else if (lower.contains("honduras") || lower.contains("tegucigalpa") || lower.contains("golfo de fonseca")) {
            action.put("type", "flyTo");
            action.put("lat", 14.07);
            action.put("lon", -87.19);
            action.put("zoom", 7.2);
            action.put("pitch", 40);
        } else if (lower.contains("fosa") || lower.contains("trinchera") || lower.contains("subducción")) {
            action.put("type", "flyTo");
            action.put("lat", 12.2);
            action.put("lon", -87.8);
            action.put("zoom", 6.2);
            action.put("pitch", 55);
        }

        return action.isEmpty() ? null : action;
    }

    private CabrakanChatResponse callGeminiChat(CabrakanChatRequest request, Map<String, Object> mapAction) {
        String systemInstruction = """
            Eres «Cabrakán AI», un Asistente Geocientífico sismológico y de protección civil de alta precisión para la plataforma Sismos Centroamérica (desarrollada por Fozna Solutions).
            Tu nombre proviene del Popol Vuh maya: Cabrakán (el dios que sacude los montes y hace temblar la tierra).
            Tu personalidad es serena, rigurosamente científica, concisa y accesible.
            Dominas la tectónica de placas de Centroamérica: subducción de la Placa de Cocos bajo la Placa del Caribe en la Fosa Mesoamericana, la Zona de Falla de Motagua-Polochic, la Zona de Fractura de Panamá y el Arco Volcánico Centroamericano.
            Entrega respuestas directas, con alta densidad técnica y sin saludos ceremoniosos, introducciones obvias ni despedidas redundantes.
            Usa listas con viñetas claras y párrafos breves.
            No uses notación LaTeX ni signos de dólar ($) para magnitudes o fórmulas (por ejemplo, escribe 'Mw 7.7', 'Ms 7.5' o 'Magnitud 7.7' en lugar de '$M_w 7.7$').
            Si el usuario pregunta por prevención, menciona pautas concretas de las instituciones regionales (CONRED, MARN/Protección Civil, COPECO, SINAPRED, CNE, SINAPROC).
            """;

        String userPrompt = "Pregunta del usuario: " + request.getMessage();

        // Incorporar contexto de sismos recientes
        List<SeismicEvent> recent = seismicEventRepository.findTop50ByOrderByTimeDesc();
        if (!recent.isEmpty()) {
            SeismicEvent latest = recent.get(0);
            double mag = latest.getMagnitude() != null ? latest.getMagnitude().doubleValue() : 0.0;
            String place = latest.getPlace() != null ? latest.getPlace() : "Centroamérica";
            double depth = latest.getDepth() != null ? latest.getDepth().doubleValue() : 0.0;
            String time = latest.getTime() != null ? latest.getTime().toString() : "Reciente";
            userPrompt += String.format(Locale.US, "\n[Contexto en Vivo: Último sismo M %.1f en %s, prof: %.1f km, fecha: %s]",
                    mag, place, depth, time);
        }

        String cleanApiKey = geminiApiKey != null ? geminiApiKey.trim() : "";
        String modelName = (geminiModel != null && !geminiModel.isBlank()) ? geminiModel.trim() : "gemini-flash-latest";
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + cleanApiKey;

        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))),
                "contents", List.of(
                        Map.of("role", "user", "parts", List.of(Map.of("text", userPrompt)))
                ),
                "generationConfig", Map.of(
                        "temperature", 0.3,
                        "maxOutputTokens", 800,
                        "thinkingConfig", Map.of("thinkingBudget", 0)
                )
        );

        String rawJson = restClient.post()
                .uri(url)
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", cleanApiKey)
                .body(body)
                .retrieve()
                .body(String.class);

        String replyText = "Disculpa, no pude procesar la respuesta en este momento.";
        try {
            JsonNode root = objectMapper.readTree(rawJson);
            JsonNode candidate = root.path("candidates").get(0);
            JsonNode parts = candidate.path("content").path("parts").get(0);
            replyText = parts.path("text").asText(replyText);
        } catch (Exception e) {
            log.warn("Error analizando respuesta de Gemini 2.5: {}", e.getMessage());
        }

        return CabrakanChatResponse.builder()
                .reply(replyText)
                .modelUsed(modelName)
                .timestamp(Instant.now().toString())
                .mapAction(mapAction)
                .suggestedQuestions(generateSuggestions(request.getMessage()))
                .build();
    }

    private CabrakanChatResponse generateExpertFallback(String message, Map<String, Object> mapAction) {
        String lower = message.toLowerCase(Locale.ROOT);
        String reply;

        if (lower.contains("placa") || lower.contains("cocos") || lower.contains("subducc")) {
            reply = """
                ### 🌋 Dinámica Geotectónica de Centroamérica
                Centroamérica es una de las regiones con mayor convergencia geodinámica del planeta:
                * **Subducción Principal:** La **Placa de Cocos** converge hacia el noreste a una velocidad de **70 a 90 mm/año**, hundiéndose por debajo de la **Placa del Caribe** en la Fosa Mesoamericana.
                * **Sismicidad de Interplaca:** Los sismos de mayor magnitud (Mw > 7.0) se generan típicamente a lo largo de este plano de fricción a profundidades de 15 a 45 km.
                * **Sismicidad Intraplaca y Arco Volcánico:** La deshidratación de la placa subducida a más de 80 km de profundidad funde el manto, originando la cadena volcánica activa que recorre Guatemala, El Salvador, Nicaragua y Costa Rica.
                """;
        } else if (lower.contains("recomiend") || lower.contains("hacer") || lower.contains("seguridad") || lower.contains("prevenc") || lower.contains("protocol")) {
            reply = """
                ### 🛡️ Protocolos de Protección Civil ante Sismos y Réplicas
                Ante un evento sísmico en Centroamérica, las agencias de emergencia recomiendan:
                1. **Durante el movimiento:**
                   * **Agáchate, Cúbrete y Sujétate** bajo una mesa firme o estructura resistente.
                   * Aléjate de ventanales, cables de alta tensión y estantes no anclados.
                2. **Evacuación:**
                   * No uses ascensores. Dirígete a zonas despejadas previamente identificadas.
                3. **Ante réplicas:**
                   * Si tu vivienda presenta grietas diagonales en paredes de carga o columnas, no ingreses hasta inspección por los cuerpos de socorro (**CONRED, CNE, SINAPROC, COPECO, SINAPRED**).
                   * Mantén lista la **Mochila de las 72 Horas** (agua potable, linterna, botiquín, radio a pilas y documentos plastificados).
                """;
        } else if (lower.contains("fuerte") || lower.contains("histor") || lower.contains("grande") || lower.contains("destructiv")) {
            reply = """
                ### 🏛️ Grandes Terremotos Históricos en Centroamérica
                El catálogo sísmico regional documenta eventos de impacto tectónico continental:
                * **1976 — Guatemala (Ms 7.5):** Ruptura superficial de más de 230 km en la Falla de Motagua.
                * **1986 — San Salvador (Mw 5.7):** Sismo intraplaca a muy baja profundidad (5 km), de alto impacto en la capital salvadoreña.
                * **1990 — Cobano / Nicoya, Costa Rica (Mw 7.0):** Interplaca en la zona de subducción del Golfo de Nicoya.
                * **2001 — El Salvador (Mw 7.7 y Mw 6.6):** Doble terremoto en enero y febrero (subducción y falla local).
                * **2021 — Golfo de Fonseca / Fosa (Mw 6.7):** Actividad continua de reajuste tectónico.
                """;
        } else {
            List<SeismicEvent> recent = seismicEventRepository.findTop50ByOrderByTimeDesc();
            String latestInfo = !recent.isEmpty()
                    ? String.format(Locale.US, "El evento más reciente registrado fue de **M %.1f** en **%s**.", recent.get(0).getMagnitude(), recent.get(0).getPlace())
                    : "Los sensores en tiempo real continúan monitorizando la Fosa Mesoamericana.";

            reply = String.format("""
                ### 🌐 Monitor Sísmico — Cabrakán AI
                %s

                En este momento la red de estaciones y el catálogo histórico de 40+ años se encuentran sincronizados.
                ¿Deseas examinar la actividad sísmica de algún país en específico, analizar la tasa de sismicidad (valor b) o consultar medidas de seguridad?
                """, latestInfo);
        }

        return CabrakanChatResponse.builder()
                .reply(reply)
                .modelUsed("offline-fallback")
                .timestamp(Instant.now().toString())
                .mapAction(mapAction)
                .suggestedQuestions(generateSuggestions(message))
                .build();
    }

    private List<String> generateSuggestions(String message) {
        String lower = message.toLowerCase(Locale.ROOT);
        if (lower.contains("guatemala")) {
            return List.of("¿Cuál es el estado de la Falla de Motagua?", "Sismicidad histórica en Guatemala", "Zonas de mayor riesgo en GT");
        } else if (lower.contains("costa rica")) {
            return List.of("¿Qué causó el terremoto de Nicoya?", "Sismicidad en la Zona Sur de Costa Rica", "Protocolos de la CNE");
        } else if (lower.contains("el salvador")) {
            return List.of("¿Qué es la Depresión Central de El Salvador?", "Enjambres sísmicos en Ilopango", "Medidas de Protección Civil");
        }
        return List.of(
                "¿Cuáles son los sismos más fuertes registrados?",
                "Muéstrame la actividad en la Fosa de Subducción",
                "¿Qué precauciones tomar ante una secuencia de réplicas?"
        );
    }

    public void streamChat(CabrakanChatRequest request, ResponseBodyEmitter emitter) {
        CompletableFuture.runAsync(() -> {
            try {
                String userMessage = request.getMessage() != null ? request.getMessage().trim() : "";
                String modelName = (geminiModel != null && !geminiModel.isBlank()) ? geminiModel.trim() : "gemini-flash-latest";

                if (userMessage.isEmpty()) {
                    sendChunk(emitter, "Hola, soy **Cabrakán AI**, tu asistente geocientífico para Centroamérica. ¿En qué puedo orientarte hoy sobre la actividad sísmica y tectónica de la región?", modelName);
                    sendComplete(emitter, null, List.of("¿Cuáles son los sismos más fuertes registrados?", "¿Cómo interactúan las placas de Cocos y el Caribe?"));
                    emitter.complete();
                    return;
                }

                Map<String, Object> mapAction = detectMapAction(userMessage);

                if (geminiApiKey != null && !geminiApiKey.isBlank()) {
                    try {
                        callGeminiStreamChat(request, mapAction, emitter);
                        emitter.complete();
                        return;
                    } catch (Exception e) {
                        log.warn("Fallo en inferencia streaming con Gemini, usando respuesta inteligente de respaldo: {}", e.getMessage());
                    }
                }

                streamExpertFallback(userMessage, mapAction, emitter);
                emitter.complete();
            } catch (Exception e) {
                log.error("Error en streaming de Cabrakán AI: {}", e.getMessage(), e);
                try {
                    emitter.completeWithError(e);
                } catch (Exception ignored) {}
            }
        });
    }

    private void callGeminiStreamChat(CabrakanChatRequest request, Map<String, Object> mapAction, ResponseBodyEmitter emitter) throws Exception {
        String systemInstruction = """
            Eres «Cabrakán AI», un Asistente Geocientífico sismológico y de protección civil de alta precisión para la plataforma Sismos Centroamérica (desarrollada por Fozna Solutions).
            Tu nombre proviene del Popol Vuh maya: Cabrakán (el dios que sacude los montes y hace temblar la tierra).
            Tu personalidad es serena, rigurosamente científica, concisa y accesible.
            Dominas la tectónica de placas de Centroamérica: subducción de la Placa de Cocos bajo la Placa del Caribe en la Fosa Mesoamericana, la Zona de Falla de Motagua-Polochic, la Zona de Fractura de Panamá y el Arco Volcánico Centroamericano.
            Entrega respuestas directas, con alta densidad técnica y sin saludos ceremoniosos, introducciones obvias ni despedidas redundantes.
            Usa listas con viñetas claras y párrafos breves.
            No uses notación LaTeX ni signos de dólar ($) para magnitudes o fórmulas (por ejemplo, escribe 'Mw 7.7', 'Ms 7.5' o 'Magnitud 7.7' en lugar de '$M_w 7.7$').
            Si el usuario pregunta por prevención, menciona pautas concretas de las instituciones regionales (CONRED, MARN/Protección Civil, COPECO, SINAPRED, CNE, SINAPROC).
            """;

        String userPrompt = "Pregunta del usuario: " + request.getMessage();
        List<SeismicEvent> recent = seismicEventRepository.findTop50ByOrderByTimeDesc();
        if (!recent.isEmpty()) {
            SeismicEvent latest = recent.get(0);
            double mag = latest.getMagnitude() != null ? latest.getMagnitude().doubleValue() : 0.0;
            String place = latest.getPlace() != null ? latest.getPlace() : "Centroamérica";
            double depth = latest.getDepth() != null ? latest.getDepth().doubleValue() : 0.0;
            String time = latest.getTime() != null ? latest.getTime().toString() : "Reciente";
            userPrompt += String.format(Locale.US, "\n[Contexto en Vivo: Último sismo M %.1f en %s, prof: %.1f km, fecha: %s]",
                    mag, place, depth, time);
        }

        String cleanApiKey = geminiApiKey != null ? geminiApiKey.trim() : "";
        String modelName = (geminiModel != null && !geminiModel.isBlank()) ? geminiModel.trim() : "gemini-flash-latest";
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":streamGenerateContent?alt=sse&key=" + cleanApiKey;

        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))),
                "contents", List.of(
                        Map.of("role", "user", "parts", List.of(Map.of("text", userPrompt)))
                ),
                "generationConfig", Map.of(
                        "temperature", 0.3,
                        "maxOutputTokens", 800,
                        "thinkingConfig", Map.of("thinkingBudget", 0)
                )
        );

        String jsonPayload = objectMapper.writeValueAsString(body);

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", cleanApiKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<java.util.stream.Stream<String>> httpResponse = client.send(httpRequest, HttpResponse.BodyHandlers.ofLines());

        if (httpResponse.statusCode() >= 400) {
            throw new RuntimeException("Error HTTP desde Gemini Stream API: " + httpResponse.statusCode());
        }

        try (java.util.stream.Stream<String> lines = httpResponse.body()) {
            lines.forEach(line -> {
                if (line.startsWith("data: ")) {
                    String jsonPart = line.substring(6).trim();
                    if (!jsonPart.isEmpty() && !"[DONE]".equals(jsonPart)) {
                        try {
                            JsonNode root = objectMapper.readTree(jsonPart);
                            JsonNode candidates = root.path("candidates");
                            if (candidates.isArray() && !candidates.isEmpty()) {
                                JsonNode parts = candidates.get(0).path("content").path("parts");
                                if (parts.isArray() && !parts.isEmpty()) {
                                    String text = parts.get(0).path("text").asText("");
                                    if (!text.isEmpty()) {
                                        sendChunk(emitter, text, modelName);
                                    }
                                }
                            }
                        } catch (Exception ex) {
                            log.debug("Chunk stream ignorado: {}", ex.getMessage());
                        }
                    }
                }
            });
        }

        sendComplete(emitter, mapAction, generateSuggestions(request.getMessage()));
    }

    private void streamExpertFallback(String message, Map<String, Object> mapAction, ResponseBodyEmitter emitter) {
        CabrakanChatResponse fallback = generateExpertFallback(message, mapAction);
        String reply = fallback.getReply();
        String[] words = reply.split(" ");
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            current.append(words[i]).append(" ");
            if ((i + 1) % 4 == 0 || i == words.length - 1) {
                sendChunk(emitter, current.toString(), "offline-fallback");
                current.setLength(0);
                try {
                    Thread.sleep(25);
                } catch (InterruptedException ignored) {}
            }
        }
        sendComplete(emitter, mapAction, fallback.getSuggestedQuestions());
    }

    private void sendChunk(ResponseBodyEmitter emitter, String text, String modelUsed) {
        try {
            Map<String, Object> chunk = Map.of(
                    "type", "chunk",
                    "text", text,
                    "modelUsed", modelUsed
            );
            emitter.send(objectMapper.writeValueAsString(chunk) + "\n");
        } catch (Exception e) {
            log.trace("Error enviando chunk: {}", e.getMessage());
        }
    }

    private void sendComplete(ResponseBodyEmitter emitter, Map<String, Object> mapAction, List<String> suggestions) {
        try {
            Map<String, Object> complete = new HashMap<>();
            complete.put("type", "complete");
            if (mapAction != null) complete.put("mapAction", mapAction);
            if (suggestions != null) complete.put("suggestedQuestions", suggestions);
            emitter.send(objectMapper.writeValueAsString(complete) + "\n");
        } catch (Exception e) {
            log.trace("Error enviando complete: {}", e.getMessage());
        }
    }
}
