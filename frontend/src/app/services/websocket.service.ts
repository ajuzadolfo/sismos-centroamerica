import { Injectable, inject, signal } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { environment } from '../../environments/environment';
import { EarthquakeService } from './earthquake.service';
import { GeoJsonFeature } from '../models/earthquake.model';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private earthquakeService = inject(EarthquakeService);
  private stompClient: Client | null = null;

  readonly isConnected = signal<boolean>(false);
  readonly connectionStatusText = signal<string>('Conectando...');

  connect() {
    const wsUrl = environment.wsUrl.startsWith('https')
      ? environment.wsUrl.replace(/^https/, 'wss')
      : environment.wsUrl.replace(/^http/, 'ws');

    this.stompClient = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 5000,
      heartbeatIncoming: 25000,
      heartbeatOutgoing: 25000
    });

    this.stompClient.onConnect = (_frame) => {
      this.isConnected.set(true);
      this.connectionStatusText.set('EN VIVO');

      // Suscribirse al canal de sismos en tiempo real
      this.stompClient?.subscribe('/topic/earthquakes', (message: IMessage) => {
        try {
          const feature: GeoJsonFeature = JSON.parse(message.body);
          this.earthquakeService.addOrUpdateEarthquake(feature);
        } catch (e) {
          console.error('Error al procesar sismo recibido por WebSocket:', e);
        }
      });

      // Suscribirse a actualizaciones de reportes comunitarios en tiempo real
      this.stompClient?.subscribe('/topic/reports', (message: IMessage) => {
        try {
          const data = JSON.parse(message.body);
          if (data && data.eventId) {
            this.earthquakeService.updateCitizenReport(
              data.eventId,
              data.totalCitizenReports,
              data.averagePerceivedIntensity
            );
          }
        } catch (e) {
          console.error('Error al procesar reporte comunitario por WebSocket:', e);
        }
      });

      // Sincronizar catálogo reciente por si hubo sismos durante una reconexión
      this.earthquakeService.loadRecentEarthquakes().subscribe();
    };

    this.stompClient.onDisconnect = () => {
      this.isConnected.set(false);
      this.connectionStatusText.set('DESCONECTADO');
    };

    this.stompClient.onStompError = (_frame) => {
      this.isConnected.set(false);
      this.connectionStatusText.set('RECONECTANDO...');
    };

    this.stompClient.activate();
  }

  disconnect() {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.isConnected.set(false);
    }
  }
}
