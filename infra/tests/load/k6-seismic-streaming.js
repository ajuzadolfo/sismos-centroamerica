// ==============================================================================
// PRUEBAS DE CARGA MASIVA Y RESILIENCIA: SIMULACIÓN DE 10,000 CONEXIONES (k6)
// Plataforma Sísmica de Centroamérica (Fozna Solutions)
// ==============================================================================

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 500 },    // Calentamiento a 500 usuarios
    { duration: '1m', target: 2500 },    // Escalado moderado
    { duration: '2m', target: 5000 },    // Pico de tráfico tras sismo M 6.5
    { duration: '1m', target: 10000 },   // Avalancha máxima de conexiones concurrentes
    { duration: '1m', target: 0 },       // Descenso
  ],
  thresholds: {
    // 95% de las respuestas REST deben responder en menos de 350ms
    http_req_duration: ['p(95)<350', 'p(99)<700'],
    // Tasa de fallos menor al 1%
    http_req_failed: ['rate<0.01'],
    // Conexión exitosa a WebSockets
    'ws_connecting{status:connected}': ['count>0'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';
const WS_URL = BASE_URL.replace('http', 'ws') + '/ws/seismic';

export default function () {
  // 1. Simulación de consulta de catálogo reciente
  const resCat = http.get(`${BASE_URL}/api/v1/earthquakes/recent`, {
    headers: { 'Accept': 'application/geo+json' },
  });

  check(resCat, {
    'Catalogo sismos status 200': (r) => r.status === 200,
    'Catalogo sismos responde rapido': (r) => r.timings.duration < 400,
  });

  // 2. Simulación de consulta analítica regional
  const resAnalytics = http.get(`${BASE_URL}/api/v1/analytics/regional-summary`);
  check(resAnalytics, {
    'Analytics status 200': (r) => r.status === 200,
  });

  // 3. Conexión WebSocket STOMP simulada
  const resWs = ws.connect(WS_URL, {}, function (socket) {
    socket.on('open', () => {
      // Protocolo STOMP CONNECT frame
      socket.send('CONNECT\naccept-version:1.2,1.1,1.0\nheart-beat:10000,10000\n\n\0');

      // Suscripción al canal de sismos en vivo
      socket.send('SUBSCRIBE\nid:sub-0\ndestination:/topic/earthquakes\n\n\0');
    });

    socket.on('message', (data) => {
      check(data, {
        'Mensaje WebSocket recibido': (d) => d.length > 0,
      });
    });

    // Mantener la sesión abierta durante 15 segundos simulando permanencia en el monitor
    socket.setTimeout(() => {
      socket.send('DISCONNECT\n\n\0');
      socket.close();
    }, 15000);
  });

  check(resWs, { 'Handshake WebSocket exitoso': (r) => r && r.status === 101 });

  sleep(1);
}
