import { Injectable } from '@angular/core';
import { Map } from 'maplibre-gl';
import { EarthquakeDetail } from '../models/earthquake.model';

export interface DeepLinkState {
  eventId?: string | null;
  lat?: number;
  lon?: number;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  preset?: string;
  minMag?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SnapshotShareService {

  private activeMap: Map | null = null;

  registerMap(map: Map) {
    this.activeMap = map;
  }

  getActiveMap(): Map | null {
    return this.activeMap;
  }

  /**
   * Genera la URL con parámetros serializados para Deep Linking
   */
  buildShareUrl(state: DeepLinkState): string {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.origin + window.location.pathname);
    
    if (state.eventId) url.searchParams.set('event', state.eventId);
    if (state.lat !== undefined) url.searchParams.set('lat', state.lat.toFixed(3));
    if (state.lon !== undefined) url.searchParams.set('lon', state.lon.toFixed(3));
    if (state.zoom !== undefined) url.searchParams.set('zoom', state.zoom.toFixed(1));
    if (state.pitch !== undefined && state.pitch > 0) url.searchParams.set('pitch', Math.round(state.pitch).toString());
    if (state.bearing !== undefined && Math.abs(state.bearing) > 1) url.searchParams.set('bearing', Math.round(state.bearing).toString());
    if (state.preset && state.preset !== 'todo') url.searchParams.set('preset', state.preset);
    if (state.minMag !== undefined && state.minMag > 0) url.searchParams.set('minMag', state.minMag.toString());

    return url.toString();
  }

  /**
   * Copia el enlace compartible al portapapeles
   */
  async copyLinkToClipboard(url: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Error copiando al portapapeles:', e);
      return false;
    }
  }

  /**
   * Captura el mapa de MapLibre GL y monta la composición gráfica institucional
   */
  async generateSnapshot(map: Map, event?: EarthquakeDetail | null): Promise<Blob> {
    const mapCanvas = map.getCanvas();
    const width = mapCanvas.width;
    const height = mapCanvas.height;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo inicializar el contexto 2D para la captura');
    }

    // 1. Dibujar el mapa base WebGL
    ctx.drawImage(mapCanvas, 0, 0, width, height);

    // Factor de escala para que se adapte a resoluciones altas o móviles
    const scale = Math.max(1, width / 1200);

    // 2. Banner Superior Institucional (Gradiente oscuro con glassmorphism)
    const headerHeight = 72 * scale;
    const headerGrad = ctx.createLinearGradient(0, 0, 0, headerHeight * 1.3);
    headerGrad.addColorStop(0, 'rgba(4, 9, 20, 0.94)');
    headerGrad.addColorStop(0.85, 'rgba(8, 14, 26, 0.88)');
    headerGrad.addColorStop(1, 'rgba(8, 14, 26, 0)');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, width, headerHeight * 1.3);

    // Título y branding Fozna
    ctx.save();
    ctx.fillStyle = '#00f0ff';
    ctx.font = `bold ${19 * scale}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.fillText('SISMOS CENTROAMÉRICA', 24 * scale, 34 * scale);

    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 ${10.5 * scale}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.fillText('MONITORIZACIÓN SÍSMICA EN TIEMPO REAL · FOZNA SOLUTIONS', 24 * scale, 52 * scale);

    // Marca de agua y hora de captura a la derecha
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = `500 ${10 * scale}px monospace`;
    ctx.fillText(nowStr, width - 24 * scale, 36 * scale);
    ctx.fillText('sismos.foznasolutions.com', width - 24 * scale, 52 * scale);
    ctx.restore();

    // 3. Si hay un sismo seleccionado, dibujar tarjeta de telemetría flotante
    if (event) {
      this.drawEarthquakeTelemetryCard(ctx, event, width, height, scale);
    }

    // 4. Cintillo Inferior con Escala ShakeMap MMI y Leyenda
    this.drawFooterLegend(ctx, width, height, scale);

    return new Promise((resolve, reject) => {
      try {
        outCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Fallo al exportar el Blob de la imagen'));
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Dibuja tarjeta flotante de telemetría del sismo
   */
  private drawEarthquakeTelemetryCard(
    ctx: CanvasRenderingContext2D,
    event: EarthquakeDetail,
    width: number,
    height: number,
    scale: number
  ) {
    ctx.save();
    const cardWidth = Math.min(width - 40 * scale, 480 * scale);
    const cardHeight = 120 * scale;
    const cardX = 24 * scale;
    const cardY = height - cardHeight - 64 * scale;

    // Fondo oscuro glassmorphic
    ctx.fillStyle = 'rgba(8, 14, 26, 0.92)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1.5 * scale;
    this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 14 * scale);
    ctx.fill();
    ctx.stroke();

    // Magnitud badge
    const mag = event.magnitude || 0;
    let magColor = '#00e676';
    if (mag >= 6.5) magColor = '#ff1744';
    else if (mag >= 5.0) magColor = '#ff9100';
    else if (mag >= 4.0) magColor = '#ffea00';

    ctx.fillStyle = magColor;
    ctx.font = `900 ${28 * scale}px monospace`;
    ctx.fillText(`M ${mag.toFixed(1)}`, cardX + 18 * scale, cardY + 40 * scale);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `bold ${12 * scale}px sans-serif`;
    ctx.fillText(event.magnitudeType ? event.magnitudeType.toUpperCase() : 'MW', cardX + 120 * scale, cardY + 36 * scale);

    // Título / Epicentro
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${14 * scale}px system-ui, sans-serif`;
    const place = event.place || event.title || 'Centroamérica';
    ctx.fillText(place.length > 40 ? place.substring(0, 38) + '...' : place, cardX + 18 * scale, cardY + 68 * scale);

    // Parámetros: Profundidad, Coordenadas, Fecha
    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 ${11 * scale}px monospace`;
    const depthStr = `Prof: ${(event.depth || 0).toFixed(1)} km | Lat: ${event.latitude.toFixed(2)}°, Lon: ${event.longitude.toFixed(2)}°`;
    ctx.fillText(depthStr, cardX + 18 * scale, cardY + 88 * scale);

    // Hora Local UTC-6 y UTC
    const dateUtc = new Date(event.time);
    const dateLocal = new Date(dateUtc.getTime() - 6 * 3600 * 1000);
    const timeStr = `UTC-6: ${dateLocal.toISOString().substring(11, 19)} | UTC: ${dateUtc.toISOString().substring(11, 19)}`;
    ctx.fillText(timeStr, cardX + 18 * scale, cardY + 106 * scale);

    ctx.restore();
  }

  /**
   * Dibuja leyenda ShakeMap MMI en el pie
   */
  private drawFooterLegend(ctx: CanvasRenderingContext2D, width: number, height: number, scale: number) {
    ctx.save();
    const footerHeight = 36 * scale;
    ctx.fillStyle = 'rgba(4, 9, 20, 0.9)';
    ctx.fillRect(0, height - footerHeight, width, footerHeight);

    // Escala de colores MMI
    const mmiColors = [
      { label: 'I-II', color: '#00e676' },
      { label: 'III-IV', color: '#76ff03' },
      { label: 'V', color: '#ffea00' },
      { label: 'VI', color: '#ff9100' },
      { label: 'VII', color: '#ff3d00' },
      { label: 'VIII+', color: '#d50000' }
    ];

    ctx.font = `600 ${9.5 * scale}px system-ui, sans-serif`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('INTENSIDAD SHAKEMAP (MMI):', 24 * scale, height - 14 * scale);

    let startX = 200 * scale;
    for (const item of mmiColors) {
      ctx.fillStyle = item.color;
      ctx.fillRect(startX, height - 22 * scale, 12 * scale, 12 * scale);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(item.label, startX + 16 * scale, height - 13 * scale);
      startX += 62 * scale;
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Fozna Solutions © 2026', width - 24 * scale, height - 13 * scale);

    ctx.restore();
  }

  /**
   * Descarga la captura directamente como archivo PNG
   */
  downloadBlob(blob: Blob, filename = 'sismo-centroamerica.png') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Comparte mediante Web Share API nativa (WhatsApp, X, Telegram, etc.)
   */
  async shareSnapshotOrUrl(
    blob: Blob | null,
    title: string,
    text: string,
    url: string
  ): Promise<'shared' | 'copied' | 'downloaded'> {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (!nav) return 'copied';

    const filename = 'sismo-' + Date.now() + '.png';

    // 1. Si soporta compartir archivos nativos (móviles Android / iOS)
    if (blob && 'canShare' in nav && typeof nav.canShare === 'function') {
      try {
        const file = new File([blob], filename, { type: 'image/png' });
        if (nav.canShare({ files: [file] })) {
          await nav.share({
            title,
            text,
            url,
            files: [file]
          });
          return 'shared';
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return 'shared'; // El usuario canceló la hoja de compartición
        }
        console.warn('Web Share API con archivos no admitida en este navegador:', err);
      }
    }

    // 2. Si solo soporta compartir texto / URL
    if ('share' in nav && typeof nav.share === 'function') {
      try {
        await nav.share({
          title,
          text: `${text}\n${url}`,
          url
        });
        return 'shared';
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return 'shared';
        }
      }
    }

    // 3. Fallback en ordenadores de escritorio: Copiar enlace y descargar captura
    if (blob) {
      this.downloadBlob(blob, filename);
      await this.copyLinkToClipboard(url);
      return 'downloaded';
    }

    await this.copyLinkToClipboard(url);
    return 'copied';
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
