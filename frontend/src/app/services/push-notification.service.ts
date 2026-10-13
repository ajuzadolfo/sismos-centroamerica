import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/notifications`;

  readonly isSubscribed = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);

  constructor() {
    this.checkCurrentSubscription();
  }

  async checkCurrentSubscription(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      this.isSubscribed.set(false);
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        this.isSubscribed.set(false);
        return false;
      }

      // Si existe suscripción pero cambió la clave VAPID pública del backend, invalidar
      try {
        const savedVapidKey = localStorage.getItem('sismos.vapidKey');
        const res = await firstValueFrom(
          this.http.get<{ publicKey: string; status: string }>(`${this.apiUrl}/vapid-public-key`)
        );
        if (res?.publicKey && savedVapidKey && res.publicKey !== savedVapidKey) {
          console.warn('[Push] Clave VAPID del backend rotada. Reiniciando suscripción previa.');
          await subscription.unsubscribe();
          localStorage.removeItem('sismos.vapidKey');
          this.isSubscribed.set(false);
          return false;
        }
      } catch {
        // En caso de fallo de red momentáneo, mantener estado reportado por el navegador
      }

      this.isSubscribed.set(true);
      return true;
    } catch {
      this.isSubscribed.set(false);
      return false;
    }
  }

  async toggleSubscription(): Promise<boolean> {
    if (this.isSubscribed()) {
      return this.unsubscribe();
    } else {
      return this.requestPermissionAndSubscribe();
    }
  }

  async requestPermissionAndSubscribe(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Web Push no soportado en este navegador.');
      return false;
    }

    this.isLoading.set(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.isLoading.set(false);
        return false;
      }

      // Obtener clave pública VAPID del backend
      const res = await firstValueFrom(
        this.http.get<{ publicKey: string; status: string }>(`${this.apiUrl}/vapid-public-key`)
      );
      if (!res || !res.publicKey) {
        this.isLoading.set(false);
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      const savedVapidKey = localStorage.getItem('sismos.vapidKey');

      if (existingSub && savedVapidKey && savedVapidKey !== res.publicKey) {
        await existingSub.unsubscribe();
      }

      const convertedVapidKey = this.urlBase64ToUint8Array(res.publicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // Enviar suscripción al backend
      const subJson = subscription.toJSON();
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/subscribe`, {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          minMagnitude: 4.5
        })
      );

      localStorage.setItem('sismos.vapidKey', res.publicKey);
      console.info('[Push] Dispositivo suscrito exitosamente a alertas sísmicas.');
      this.isSubscribed.set(true);
      this.isLoading.set(false);
      return true;
    } catch (e) {
      console.error('[Push] Error al suscribir a alertas push:', e);
      this.isLoading.set(false);
      return false;
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    this.isLoading.set(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await firstValueFrom(
          this.http.post(`${this.apiUrl}/unsubscribe`, { endpoint })
        );
      }
      localStorage.removeItem('sismos.vapidKey');
      this.isSubscribed.set(false);
      this.isLoading.set(false);
      return true;
    } catch (e) {
      console.error('[Push] Error al desuscribir:', e);
      this.isLoading.set(false);
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
