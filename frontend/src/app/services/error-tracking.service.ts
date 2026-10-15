import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface ClientTelemetryPayload {
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  errorType: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorTrackingService {

  private readonly throttleMap = new Map<string, number>();
  private readonly THROTTLE_MS = 15000; // 15 segundos entre errores idénticos

  /**
   * Captura y reporta un error ocurrido en el cliente hacia Google Cloud Logging / Sentry
   */
  captureError(error: unknown, context?: string): void {
    const errorDetails = this.extractErrorDetails(error, context);
    const fingerprint = `${errorDetails.errorType}_${errorDetails.message}`;

    const now = Date.now();
    const lastSent = this.throttleMap.get(fingerprint) || 0;
    if (now - lastSent < this.THROTTLE_MS) {
      // Error duplicado dentro de la ventana de aceleración (evita tormentas de red)
      return;
    }
    this.throttleMap.set(fingerprint, now);

    if (!environment.production) {
      console.warn(`[Telemetry] 🚨 Error capturado (${errorDetails.errorType}):`, errorDetails.message, error);
    }

    this.sendToBackend(errorDetails);
    this.sendToSentryIfConfigured(errorDetails);
  }

  /**
   * Extrae mensaje, traza y tipo clasificado del error
   */
  private extractErrorDetails(error: unknown, context?: string): ClientTelemetryPayload {
    let message = 'Unknown Client Error';
    let stack = '';

    if (error instanceof Error) {
      message = error.message;
      stack = error.stack || '';
    } else if (typeof error === 'string') {
      message = error;
    } else if (typeof error === 'object' && error !== null) {
      const record = error as Record<string, unknown>;
      message = typeof record['message'] === 'string' ? record['message'] : JSON.stringify(record);
      stack = typeof record['stack'] === 'string' ? record['stack'] : '';
    }

    if (context) {
      message = `[${context}] ${message}`;
    }

    const errorType = this.classifyError(message, stack);

    return {
      message: message.substring(0, 1000),
      stack: stack.substring(0, 1500),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      errorType,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clasifica automáticamente la naturaleza técnica del fallo en la plataforma
   */
  private classifyError(message: string, stack: string): string {
    const text = (message + ' ' + stack).toLowerCase();

    if (text.includes('webgl') || text.includes('context lost') || text.includes('maplibre')) {
      return 'WebGL_Map_Error';
    }
    if (text.includes('audio') || text.includes('play()') || text.includes('notallowederror')) {
      return 'Audio_Autoplay_Blocked';
    }
    if (text.includes('push') || text.includes('serviceworker') || text.includes('vapid') || text.includes('notification')) {
      return 'Push_Notification_Error';
    }
    if (text.includes('stream') || text.includes('cabrakan') || text.includes('event-stream')) {
      return 'AI_Streaming_Error';
    }
    return 'Angular_Runtime_Exception';
  }

  /**
   * Envía la telemetría al backend mediante sendBeacon (resistente a descargas) o fetch
   */
  private sendToBackend(payload: ClientTelemetryPayload): void {
    if (typeof window === 'undefined') return;

    const endpoint = `${environment.apiUrl}/analytics/client-errors`;
    const jsonBody = JSON.stringify(payload);

    try {
      if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        const blob = new Blob([jsonBody], { type: 'application/json' });
        const success = navigator.sendBeacon(endpoint, blob);
        if (success) return;
      }

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonBody,
        keepalive: true
      }).catch(() => {
        // Fallo de red silencioso para no generar errores cíclicos
      });
    } catch {
      // Ignorar errores al enviar el reporte
    }
  }

  /**
   * Si el usuario configuró una clave Sentry DSN en environment.ts, envía la excepción al endpoint oficial de Sentry
   */
  private sendToSentryIfConfigured(payload: ClientTelemetryPayload): void {
    const dsn = (environment as { sentryDsn?: string }).sentryDsn;
    if (!dsn || !dsn.startsWith('https://')) return;

    try {
      // Parsear componentes de Sentry DSN: https://<key>@<host>/<projectId>
      const url = new URL(dsn);
      const key = url.username;
      const host = url.host;
      const projectId = url.pathname.replace('/', '');

      if (!key || !host || !projectId) return;

      const sentryUrl = `https://${host}/api/${projectId}/store/?sentry_version=7&sentry_key=${key}`;
      const sentryBody = JSON.stringify({
        message: payload.message,
        level: 'error',
        platform: 'javascript',
        logger: payload.errorType,
        extra: {
          url: payload.url,
          userAgent: payload.userAgent,
          stack: payload.stack,
          timestamp: payload.timestamp
        }
      });

      fetch(sentryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: sentryBody,
        keepalive: true
      }).catch(() => {
        // Silencioso
      });
    } catch {
      // Silencioso
    }
  }
}
