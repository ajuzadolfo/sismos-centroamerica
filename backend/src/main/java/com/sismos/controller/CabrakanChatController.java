package com.sismos.controller;

import com.sismos.model.dto.CabrakanChatRequest;
import com.sismos.model.dto.CabrakanChatResponse;
import com.sismos.service.CabrakanAiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class CabrakanChatController {

    private final CabrakanAiService cabrakanAiService;

    @PostMapping("/cabrakan")
    public ResponseEntity<CabrakanChatResponse> chat(@RequestBody CabrakanChatRequest request) {
        return ResponseEntity.ok(cabrakanAiService.chat(request));
    }
}
