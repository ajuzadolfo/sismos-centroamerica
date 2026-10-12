import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/notifications`;

  async requestPermissionAndSubscribe(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Web Push no soportado en este navegador.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return false;
      }

      // Obtener clave pública VAPID del backend
      const res = await this.http.get<{ publicKey: string; status: string }>(`${this.apiUrl}/vapid-public-key`).toPromise();
      if (!res || !res.publicKey) {
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const convertedVapidKey = this.urlBase64ToUint8Array(res.publicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // Enviar suscripción al backend
      const subJson = subscription.toJSON();
      await this.http.post(`${this.apiUrl}/subscribe`, {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        minMagnitude: 4.5
      }).toPromise();

      console.info('[Push] Dispositivo suscrito exitosamente a alertas sísmicas.');
      return true;
    } catch (e) {
      console.error('[Push] Error al suscribir a alertas push:', e);
      return false;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
