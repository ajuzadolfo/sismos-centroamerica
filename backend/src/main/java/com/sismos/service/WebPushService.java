package com.sismos.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sismos.model.dto.PushSubscriptionRequestDto;
import com.sismos.model.entity.PushSubscription;
import com.sismos.model.entity.SeismicEvent;
import com.sismos.repository.PushSubscriptionRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.Security;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class WebPushService {

    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final ObjectMapper objectMapper;

    @Value("${vapid.public.key:#{null}}")
    private String vapidPublicKey;

    @Value("${vapid.private.key:#{null}}")
    private String vapidPrivateKey;

    @Value("${vapid.subject:mailto:soporte@foznasolutions.com}")
    private String vapidSubject;

    private PushService pushService;

    @PostConstruct
    public void init() {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }

        if (vapidPublicKey != null && !vapidPublicKey.isBlank() &&
            vapidPrivateKey != null && !vapidPrivateKey.isBlank()) {
            try {
                this.pushService = new PushService(vapidPublicKey, vapidPrivateKey, vapidSubject);
                log.info("[Web Push] Servicio VAPID inicializado correctamente.");
            } catch (Exception e) {
                log.warn("[Web Push] No se pudieron cargar las llaves VAPID: {}", e.getMessage());
            }
        } else {
            log.info("[Web Push] Claves VAPID no configuradas en este entorno. Las notificaciones push permanecerán inactivas.");
        }
    }

    public String getPublicKey() {
        return vapidPublicKey;
    }

    @Transactional
    public void subscribe(PushSubscriptionRequestDto request) {
        String p256dh = request.getKeys() != null ? request.getKeys().get("p256dh") : "";
        String auth = request.getKeys() != null ? request.getKeys().get("auth") : "";
        BigDecimal minMag = request.getMinMagnitude() != null ? request.getMinMagnitude() : BigDecimal.valueOf(4.5);

        PushSubscription sub = pushSubscriptionRepository.findByEndpoint(request.getEndpoint())
                .orElse(PushSubscription.builder()
                        .endpoint(request.getEndpoint())
                        .subscribedAt(Instant.now())
                        .build());

        sub.setP256dh(p256dh);
        sub.setAuth(auth);
        sub.setMinMagnitude(minMag);

        pushSubscriptionRepository.save(sub);
        log.info("[Web Push] Suscripción registrada/actualizada con éxito para endpoint: {}", request.getEndpoint());
    }

    @Transactional
    public void unsubscribe(String endpoint) {
        pushSubscriptionRepository.deleteByEndpoint(endpoint);
        log.info("[Web Push] Suscripción eliminada: {}", endpoint);
    }

    @Async
    public void sendSeismicAlert(SeismicEvent event) {
        if (pushService == null) {
            return;
        }

        BigDecimal mag = event.getMagnitude() != null ? event.getMagnitude() : BigDecimal.valueOf(4.0);
        List<PushSubscription> eligible = pushSubscriptionRepository.findEligibleSubscriptions(mag);

        if (eligible.isEmpty()) {
            return;
        }

        log.info("[Web Push] Enviando alerta sísmica (M {}) a {} dispositivos suscritos...", mag, eligible.size());

        Map<String, Object> payload = Map.of(
                "title", String.format("⚠️ Alerta Sísmica M %.1f - Centroamérica", mag),
                "body", String.format("%s - Profundidad: %.1f km", event.getTitle(), event.getDepth().doubleValue()),
                "url", "/monitor?event=" + event.getId()
        );

        byte[] payloadBytes;
        try {
            payloadBytes = objectMapper.writeValueAsBytes(payload);
        } catch (Exception e) {
            log.error("[Web Push] Error serializando payload: {}", e.getMessage());
            return;
        }

        for (PushSubscription sub : eligible) {
            try {
                Notification notification = new Notification(
                        sub.getEndpoint(),
                        sub.getP256dh(),
                        sub.getAuth(),
                        payloadBytes
                );
                pushService.send(notification);
                sub.setLastNotifiedAt(Instant.now());
                pushSubscriptionRepository.save(sub);
            } catch (Exception e) {
                log.warn("[Web Push] Fallo al entregar notificación al endpoint {}: {}", sub.getEndpoint(), e.getMessage());
            }
        }
    }
}
