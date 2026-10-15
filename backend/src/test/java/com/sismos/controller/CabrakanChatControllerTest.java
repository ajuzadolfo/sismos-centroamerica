package com.sismos.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sismos.model.dto.CabrakanChatRequest;
import com.sismos.model.dto.CabrakanChatResponse;
import com.sismos.service.CabrakanAiService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CabrakanChatController.class)
class CabrakanChatControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CabrakanAiService cabrakanAiService;

    @Test
    @DisplayName("POST /api/v1/chat/cabrakan debe retornar respuesta de Cabrakán AI con Gemini 2.5")
    void shouldReturnCabrakanChatResponse() throws Exception {
        CabrakanChatResponse mockResponse = CabrakanChatResponse.builder()
                .reply("Hola, soy Cabrakán AI.")
                .modelUsed("gemini-2.5-flash")
                .mapAction(Map.of("type", "flyTo", "lat", 14.63, "lon", -90.51, "zoom", 7.2))
                .suggestedQuestions(List.of("¿Cuáles son los sismos más fuertes?"))
                .build();

        when(cabrakanAiService.chat(any(CabrakanChatRequest.class))).thenReturn(mockResponse);

        CabrakanChatRequest request = CabrakanChatRequest.builder()
                .message("Hola Cabrakán, muéstrame Guatemala")
                .build();

        mockMvc.perform(post("/api/v1/chat/cabrakan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reply").value("Hola, soy Cabrakán AI."))
                .andExpect(jsonPath("$.modelUsed").value("gemini-2.5-flash"))
                .andExpect(jsonPath("$.mapAction.type").value("flyTo"))
                .andExpect(jsonPath("$.mapAction.lat").value(14.63));
    }
}
