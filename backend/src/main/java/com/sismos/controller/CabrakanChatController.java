package com.sismos.controller;

import com.sismos.model.dto.CabrakanChatRequest;
import com.sismos.model.dto.CabrakanChatResponse;
import com.sismos.service.CabrakanAiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

@RestController
@RequestMapping("/api/v1/chat")
public class CabrakanChatController {

    private final CabrakanAiService cabrakanAiService;

    public CabrakanChatController(CabrakanAiService cabrakanAiService) {
        this.cabrakanAiService = cabrakanAiService;
    }

    @PostMapping("/cabrakan")
    public ResponseEntity<CabrakanChatResponse> chat(@RequestBody CabrakanChatRequest request) {
        return ResponseEntity.ok(cabrakanAiService.chat(request));
    }

    @PostMapping(value = "/cabrakan/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseBodyEmitter streamChat(@RequestBody CabrakanChatRequest request) {
        ResponseBodyEmitter emitter = new ResponseBodyEmitter(90000L);
        cabrakanAiService.streamChat(request, emitter);
        return emitter;
    }
}
