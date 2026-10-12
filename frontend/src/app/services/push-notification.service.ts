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
      const active = !!subscription;
      this.isSubscribed.set(active);
      return active;
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
