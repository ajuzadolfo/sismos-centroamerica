package com.sismos.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CabrakanChatResponse {
    private String reply;
    private String modelUsed;
    private String timestamp;
    private Map<String, Object> mapAction; // e.g., { type: "flyTo", lat: 14.2, lon: -90.5, zoom: 7.5, pitch: 45, eventId: "..." }
    private List<String> suggestedQuestions;
}
