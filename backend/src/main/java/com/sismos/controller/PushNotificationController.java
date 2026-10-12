package com.sismos.controller;

import com.sismos.model.dto.PushSubscriptionRequestDto;
import com.sismos.service.WebPushService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class PushNotificationController {

    private final WebPushService webPushService;

    @GetMapping("/vapid-public-key")
    public ResponseEntity<Map<String, String>> getVapidPublicKey() {
        String key = webPushService.getPublicKey();
        if (key == null || key.isBlank()) {
            return ResponseEntity.ok(Map.of("publicKey", "", "status", "DISABLED"));
        }
        return ResponseEntity.ok(Map.of("publicKey", key, "status", "ACTIVE"));
    }

    @PostMapping("/subscribe")
    public ResponseEntity<Map<String, String>> subscribe(@Valid @RequestBody PushSubscriptionRequestDto request) {
        webPushService.subscribe(request);
        return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Suscripción Web Push registrada con éxito"));
    }

    @PostMapping("/unsubscribe")
    public ResponseEntity<Map<String, String>> unsubscribe(@RequestBody Map<String, String> payload) {
        String endpoint = payload.get("endpoint");
        if (endpoint != null && !endpoint.isBlank()) {
            webPushService.unsubscribe(endpoint);
        }
        return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Suscripción Web Push eliminada"));
    }
}
