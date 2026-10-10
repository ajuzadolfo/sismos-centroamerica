import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Map, GeoJSONSource, Popup, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
import { EarthquakeService } from '../../services/earthquake.service';
import { AudioAlertService } from '../../services/audio-alert.service';
import { SeismographHudComponent } from './seismograph-hud.component';
import { environment } from '../../../environments/environment';
import { GeoJsonFeature } from '../../models/earthquake.model';

function createPulsingDot(map: Map, size = 160, rgbColor = '0, 240, 255') {
  return {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4) as Uint8Array | Uint8ClampedArray,
    context: null as CanvasRenderingContext2D | null,

    onAdd: function () {
      const canvas = document.createElement('canvas');
      canvas.width = this.width;
      canvas.height = this.height;
      this.context = canvas.getContext('2d', { willReadFrequently: true });
    },

    render: function () {
      const duration = 2200;
      const t = (performance.now() % duration) / duration;
      const radius = (size / 2) * 0.22;
      const outerRadius = (size / 2) * 0.78 * t + radius;
      const ctx = this.context;
      if (!ctx) return false;

      ctx.clearRect(0, 0, this.width, this.height);

      // Onda P primaria (expansión de choque translúcida)
      ctx.beginPath();
      ctx.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgbColor}, ${(1 - t) * 0.7})`;
      ctx.fill();

      // Onda S secundaria concéntrica
      const t2 = (t + 0.38) % 1;
      const outerRadius2 = (size / 2) * 0.65 * t2 + radius;
      ctx.beginPath();
      ctx.arc(this.width / 2, this.height / 2, outerRadius2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rgbColor}, ${(1 - t2) * 0.85})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Núcleo brillante
      ctx.beginPath();
      ctx.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${rgbColor})`;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      this.data = ctx.getImageData(0, 0, this.width, this.height).data;
      map.triggerRepaint();
      return true;
    }
  };
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, SeismographHudComponent],
  template: `
    <div class="map-wrapper">
      <div #mapContainer class="map-container"></div>

      <!-- Barra Flotante de Modos de Cámara y Presets 3D -->
      <div class="camera-bar glass-panel">
        <span class="camera-title">VISTA CÁMARA</span>
        <div class="preset-buttons">
          <button
            class="preset-btn"
            [class.active]="activePreset() === 'todo'"
            (click)="setCameraPreset('todo')"
            title="Vista global de Centroamérica">
            🌐 Todo
          </button>
          <button
            class="preset-btn"
            [class.active]="activePreset() === 'trinchera'"
            (click)="setCameraPreset('trinchera')"
            title="Perspectiva 3D inclinada sobre la Fosa Mesoamericana">
            🌋 Fosa 3D
          </button>
          <button
            class="preset-btn"
            [class.active]="activePreset() === 'norte'"
            (click)="setCameraPreset('norte')"
            title="Enfocar Guatemala y El Salvador">
            🇬🇹 Norte
          </button>
          <button
            class="preset-btn"
            [class.active]="activePreset() === 'sur'"
            (click)="setCameraPreset('sur')"
            title="Enfocar Costa Rica y Panamá">
            🇨🇷 Sur
          </button>
        </div>

        <button
          class="tilt-toggle-btn"
          [class.active]="is3DMode()"
          (click)="toggle3DMode()"
          title="Alternar inclinación y perspectiva 2.5D del terreno">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          <span>{{ is3DMode() ? '3D ACTIVO' : '2D PLANO' }}</span>
        </button>
      </div>

      <!-- Osciloscopio Sísmico y HUD de Telemetría -->
      <app-seismograph-hud
        #seismographHud
        [coordinatesText]="coordinatesText()"
        [pitchText]="pitchText()"
      />

      <!-- Indicador de Carga WebGL -->
      @if (earthquakeService.loading()) {
        <div class="loading-overlay glass-panel">
          <div class="spinner"></div>
          <span>Sincronizando catálogo sísmico...</span>
        </div>
      }

      <!-- Leyenda de Magnitud -->
      <div class="legend-panel glass-panel">
        <div class="legend-title">MAGNITUD (Mw)</div>
        <div class="legend-items">
          <div class="legend-item"><span class="dot mag-low"></span> &lt; 3.5 Menor</div>
          <div class="legend-item"><span class="dot mag-med"></span> 3.5 - 4.4 Moderado</div>
          <div class="legend-item"><span class="dot mag-high"></span> 4.5 - 5.9 Fuerte</div>
          <div class="legend-item"><span class="dot mag-major"></span> &ge; 6.0 Mayor</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .map-wrapper {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }

    .map-container {
      width: 100%;
      height: 100%;
    }

    .camera-bar {
      position: absolute;
      top: 92px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px;
      z-index: 50;
      border-radius: 30px;
      background: rgba(8, 14, 26, 0.82);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(0, 240, 255, 0.22);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 240, 255, 0.1);
      transition: all 0.3s ease;
    }

    .camera-title {
      font-size: 0.62rem;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.08em;
      padding-right: 4px;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      user-select: none;
    }

    .preset-buttons {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .preset-btn {
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid transparent;
      border-radius: 20px;
      color: #94a3b8;
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: var(--font-sans);
    }

    .preset-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    .preset-btn.active {
      background: rgba(0, 240, 255, 0.16);
      border-color: rgba(0, 240, 255, 0.5);
      color: #00f0ff;
      box-shadow: 0 0 12px rgba(0, 240, 255, 0.25);
    }

    .tilt-toggle-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 11px;
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.35);
      border-radius: 20px;
      color: #c4b5fd;
      font-size: 0.7rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: var(--font-sans);
    }

    .tilt-toggle-btn:hover {
      background: rgba(139, 92, 246, 0.25);
      color: #ffffff;
    }

    .tilt-toggle-btn.active {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.25) 0%, rgba(139, 92, 246, 0.25) 100%);
      border-color: #00f0ff;
      color: #00f0ff;
      box-shadow: 0 0 14px rgba(0, 240, 255, 0.3);
    }

    .loading-overlay {
      position: absolute;
      top: 92px;
      left: 16px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text-primary);
      z-index: 50;
      background: rgba(8, 14, 26, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 240, 255, 0.2);
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(0, 240, 255, 0.2);
      border-top-color: var(--accent-cyan);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .legend-panel {
      position: absolute;
      bottom: 110px;
      right: 16px;
      padding: 12px 16px;
      z-index: 40;
      font-size: 0.75rem;
      background: rgba(8, 14, 26, 0.82);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
    }

    .legend-title {
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    .legend-items {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-weight: 500;
    }

    .legend-item .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .dot.mag-low { background: #00e676; box-shadow: 0 0 6px #00e676; }
    .dot.mag-med { background: #ffea00; box-shadow: 0 0 6px #ffea00; }
    .dot.mag-high { background: #ff9100; box-shadow: 0 0 6px #ff9100; }
    .dot.mag-major { background: #ff1744; box-shadow: 0 0 8px #ff1744; }

    @media (max-width: 768px) {
      .camera-bar {
        top: 84px;
        padding: 4px 8px;
        gap: 6px;
      }
      .camera-title {
        display: none;
      }
      .preset-btn {
        padding: 3px 7px;
        font-size: 0.65rem;
      }
      .tilt-toggle-btn {
        padding: 3px 8px;
        font-size: 0.65rem;
      }
    }
  `]
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('seismographHud') seismographHud?: SeismographHudComponent;

  earthquakeService = inject(EarthquakeService);
  audioService = inject(AudioAlertService);

  private map: Map | null = null;
  private activePopup: Popup | null = null;

  // Estados de Telemetría y Controles de Cámara
  coordinatesText = signal<string>('13.50° N, 86.50° W');
  pitchText = signal<string>('0° [2D]');
  is3DMode = signal<boolean>(false);
  activePreset = signal<'todo' | 'trinchera' | 'norte' | 'sur'>('todo');

  constructor() {
    // Efecto reactivo con Angular Signals: actualiza la fuente GeoJSON del mapa sin re-renderizar todo
    effect(() => {
      const data = this.earthquakeService.filteredEarthquakes();
      this.updateMapData(data);
    });

    // Efecto para activar / desactivar mapa de calor
    effect(() => {
      const isHeatmap = this.earthquakeService.isHeatmapActive();
      this.toggleHeatmapVisibility(isHeatmap);
    });

    // Efecto para animar nuevos sismos recibidos en vivo con audio y osciloscopio
    effect(() => {
      const newEvent = this.earthquakeService.latestNewEvent();
      if (newEvent && this.map) {
        this.animateNewEvent(newEvent);
      }
    });

    // Efecto para visualizar la capa de reportes ciudadanos comunitarios
    effect(() => {
      const clusters = this.earthquakeService.selectedCitizenClusters();
      this.updateCitizenClustersLayer(clusters);
    });
  }

  ngOnInit() {
    this.initMap();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap() {
    if (typeof window !== 'undefined') {
      setWorkerUrl(`${window.location.origin}/maplibre-gl-worker.mjs`);
    }

    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: environment.cartoDarkStyle,
      center: [-86.5, 13.5], // Centroamérica
      zoom: 5.6,
      minZoom: 3,
      maxZoom: 16
    });

    this.map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    this.map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    this.map.on('load', () => {
      this.initAnimatedPulseIcons();
      this.setupLayers();
      this.loadGeologicalFaults();
      this.earthquakeService.loadRecentEarthquakes().subscribe();
    });

    // Seguimiento dinámico de coordenadas y perspectiva
    this.map.on('mousemove', (e) => {
      const lat = e.lngLat.lat;
      const lng = e.lngLat.lng;
      const latDir = lat >= 0 ? 'N' : 'S';
      const lngDir = lng >= 0 ? 'E' : 'W';
      this.coordinatesText.set(`${Math.abs(lat).toFixed(2)}° ${latDir}, ${Math.abs(lng).toFixed(2)}° ${lngDir}`);
    });

    const updateCameraState = () => {
      if (!this.map) return;
      const pitch = Math.round(this.map.getPitch());
      const is3D = pitch > 10;
      this.is3DMode.set(is3D);
      this.pitchText.set(`${pitch}° [${is3D ? '3D' : '2D'}]`);
    };

    this.map.on('pitchend', updateCameraState);
    this.map.on('rotateend', updateCameraState);
  }

  private initAnimatedPulseIcons() {
    if (!this.map) return;
    if (!this.map.hasImage('pulsing-dot-cyan')) {
      this.map.addImage('pulsing-dot-cyan', createPulsingDot(this.map, 140, '0, 240, 255'), { pixelRatio: 2 });
    }
    if (!this.map.hasImage('pulsing-dot-amber')) {
      this.map.addImage('pulsing-dot-amber', createPulsingDot(this.map, 150, '255, 145, 0'), { pixelRatio: 2 });
    }
    if (!this.map.hasImage('pulsing-dot-major')) {
      this.map.addImage('pulsing-dot-major', createPulsingDot(this.map, 180, '255, 23, 68'), { pixelRatio: 2 });
    }
  }

  private setupLayers() {
    if (!this.map) return;

    // 1. Fuente GeoJSON de sismos con clustering dinámico
    this.map.addSource('earthquakes', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 40
    });

    // 2. Capa de Mapa de Calor (Heatmap)
    this.map.addLayer({
      id: 'earthquakes-heat',
      type: 'heatmap',
      source: 'earthquakes',
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight': [
          'interpolate', ['linear'], ['get', 'magnitude'],
          1, 0,
          7, 1
        ],
        'heatmap-intensity': [
          'interpolate', ['linear'], ['zoom'],
          3, 1,
          10, 3
        ],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0, 240, 255, 0)',
          0.2, '#00e676',
          0.4, '#ffea00',
          0.7, '#ff9100',
          1, '#ff1744'
        ],
        'heatmap-radius': [
          'interpolate', ['linear'], ['zoom'],
          3, 15,
          10, 40
        ],
        'heatmap-opacity': 0.85
      }
    });

    // 3. ONDAS SÍSMICAS ANIMADAS (P & S shockwave rings para sismos destacados)
    this.map.addLayer({
      id: 'pulsing-waves-cyan',
      type: 'symbol',
      source: 'earthquakes',
      filter: ['all', ['!', ['has', 'point_count']], ['>=', ['get', 'magnitude'], 3.8], ['<', ['get', 'magnitude'], 5.0]],
      layout: {
        'icon-image': 'pulsing-dot-cyan',
        'icon-size': 0.75,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    });

    this.map.addLayer({
      id: 'pulsing-waves-major',
      type: 'symbol',
      source: 'earthquakes',
      filter: ['all', ['!', ['has', 'point_count']], ['>=', ['get', 'magnitude'], 5.0]],
      layout: {
        'icon-image': 'pulsing-dot-major',
        'icon-size': 0.95,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    });

    // 4. Capa de Círculos Agrupados (Clusters)
    this.map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'earthquakes',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step', ['get', 'point_count'],
          'rgba(0, 230, 118, 0.85)',
          10, 'rgba(255, 234, 0, 0.85)',
          30, 'rgba(255, 145, 0, 0.85)',
          75, 'rgba(255, 23, 68, 0.85)'
        ],
        'circle-radius': [
          'step', ['get', 'point_count'],
          18,
          10, 24,
          30, 30,
          75, 36
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // 5. Conteo numérico dentro del cluster
    this.map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'earthquakes',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Bold'],
        'text-size': 12
      },
      paint: {
        'text-color': '#0f172a'
      }
    });

    // 6. Capa de Puntos Individuales (Sismos no agrupados)
    this.map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'earthquakes',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'step', ['get', 'magnitude'],
          '#00e676',
          3.5, '#ffea00',
          4.5, '#ff9100',
          6.0, '#ff1744'
        ],
        'circle-radius': [
          'interpolate', ['linear'], ['get', 'magnitude'],
          1.0, 5,
          4.0, 9,
          6.0, 15,
          8.0, 24
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(255, 255, 255, 0.8)',
        'circle-opacity': 0.95
      }
    });

    // 7. Capa de Reportes Ciudadanos Comunitarios ("¿Lo sentiste?")
    this.map.addSource('citizen-reports-clusters', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    this.map.addLayer({
      id: 'citizen-clusters-glow',
      type: 'circle',
      source: 'citizen-reports-clusters',
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['get', 'reportCount'],
          1, 14,
          5, 24,
          20, 40
        ],
        'circle-color': [
          'interpolate', ['linear'], ['get', 'averageIntensity'],
          1, '#00e676',
          2.5, '#ffea00',
          3.5, '#ff9100',
          4.5, '#ff1744'
        ],
        'circle-opacity': 0.35,
        'circle-blur': 0.6
      }
    });

    this.map.addLayer({
      id: 'citizen-clusters-circle',
      type: 'circle',
      source: 'citizen-reports-clusters',
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['get', 'reportCount'],
          1, 10,
          5, 18,
          20, 28
        ],
        'circle-color': [
          'interpolate', ['linear'], ['get', 'averageIntensity'],
          1, '#00e676',
          2.5, '#ffea00',
          3.5, '#ff9100',
          4.5, '#ff1744'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      }
    });

    this.map.addLayer({
      id: 'citizen-clusters-label',
      type: 'symbol',
      source: 'citizen-reports-clusters',
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'reportCount']], ' rep'],
        'text-font': ['Open Sans Bold'],
        'text-size': 10,
        'text-offset': [0, 0.2]
      },
      paint: {
        'text-color': '#020617'
      }
    });

    // Eventos interactivos del mapa
    this.registerMapEvents();
  }

  private registerMapEvents() {
    if (!this.map) return;

    // Clic en cluster: acercar cámara al cluster
    this.map.on('click', 'clusters', (e) => {
      const features = this.map!.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0].properties['cluster_id'];
      const source = this.map!.getSource('earthquakes') as GeoJSONSource;

      source.getClusterExpansionZoom(clusterId).then((zoom) => {
        const coords = (features[0].geometry as any).coordinates;
        this.map!.easeTo({ center: coords, zoom: zoom });
      });
    });

    // Clic en sismo individual: abrir popup estilizado
    this.map.on('click', 'unclustered-point', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const coords = (feature.geometry as any).coordinates.slice();
      const props = feature.properties;
      const mag = Number(props['magnitude']) || 0;
      const depth = Number(props['depth']) || 0;

      this.earthquakeService.selectEarthquake(feature.id as string);
      this.seismographHud?.triggerSeismicSpike(mag);

      const timeStr = new Date(props['time']).toLocaleString('es', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      const magColor = mag < 3.5 ? '#00e676' : (mag < 4.5 ? '#ffea00' : (mag < 6.0 ? '#ff9100' : '#ff1744'));

      const popupHtml = `
        <div style="font-family: Outfit, sans-serif; min-width: 220px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-weight: 800; font-size: 1.25rem; color: ${magColor}; letter-spacing: -0.02em;">
              M ${mag.toFixed(1)}
            </span>
            <span style="font-size: 0.72rem; color: #94a3b8; font-family: monospace; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px;">
              ${depth.toFixed(1)} km prof.
            </span>
          </div>

          <!-- Barra de Profundidad -->
          <div style="background: rgba(255,255,255,0.08); height: 4px; border-radius: 2px; margin-bottom: 10px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #00f0ff, #8b5cf6); width: ${Math.min(100, (depth / 150) * 100)}%; height: 100%;"></div>
          </div>

          <div style="font-weight: 600; font-size: 0.9rem; color: #f8fafc; margin-bottom: 4px; line-height: 1.3;">
            ${props['place'] || props['title']}
          </div>

          <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 12px; font-family: monospace;">
            ${timeStr}
          </div>

          <div style="display: flex; gap: 6px;">
            <button id="popup-report-btn" style="
              flex: 1;
              padding: 7px 10px;
              background: linear-gradient(135deg, #00f0ff 0%, #0284c7 100%);
              border: none;
              border-radius: 6px;
              color: #020617;
              font-weight: 700;
              font-size: 0.75rem;
              cursor: pointer;
              transition: transform 0.15s ease;
            ">¿Lo sentiste?</button>

            <button id="popup-3d-btn" style="
              padding: 7px 10px;
              background: rgba(139, 92, 246, 0.2);
              border: 1px solid rgba(139, 92, 246, 0.4);
              border-radius: 6px;
              color: #c4b5fd;
              font-weight: 700;
              font-size: 0.75rem;
              cursor: pointer;
            ">3D</button>
          </div>
        </div>
      `;

      if (this.activePopup) this.activePopup.remove();

      this.activePopup = new Popup({ offset: 12, closeButton: true })
        .setLngLat(coords)
        .setHTML(popupHtml)
        .addTo(this.map!);

      // Escuchar eventos en botones del popup
      setTimeout(() => {
        const reportBtn = document.getElementById('popup-report-btn');
        if (reportBtn) {
          reportBtn.onclick = () => {
            this.earthquakeService.selectEarthquake(feature.id as string);
          };
        }
        const tiltBtn = document.getElementById('popup-3d-btn');
        if (tiltBtn) {
          tiltBtn.onclick = () => {
            this.map!.flyTo({
              center: coords,
              zoom: 8.5,
              pitch: 58,
              bearing: -15,
              duration: 1500
            });
            this.is3DMode.set(true);
          };
        }
      }, 100);
    });

    // Cambiar cursor a pointer al pasar sobre sismos o clusters
    this.map.on('mouseenter', 'clusters', () => this.map!.getCanvas().style.cursor = 'pointer');
    this.map.on('mouseleave', 'clusters', () => this.map!.getCanvas().style.cursor = '');
    this.map.on('mouseenter', 'unclustered-point', () => this.map!.getCanvas().style.cursor = 'pointer');
    this.map.on('mouseleave', 'unclustered-point', () => this.map!.getCanvas().style.cursor = '');
  }

  private loadGeologicalFaults() {
    this.earthquakeService.getFaults().subscribe({
      next: (faultsData) => {
        if (!this.map || !faultsData) return;

        this.map.addSource('geological-faults', {
          type: 'geojson',
          data: faultsData
        });

        // 1. Resplandor exterior difuso (Outer Glow bioluminiscente)
        this.map.addLayer({
          id: 'faults-outer-glow',
          type: 'line',
          source: 'geological-faults',
          paint: {
            'line-color': '#ff0055',
            'line-width': 8,
            'line-blur': 6,
            'line-opacity': 0.5
          }
        });

        // 2. Halo neón medio
        this.map.addLayer({
          id: 'faults-neon-aura',
          type: 'line',
          source: 'geological-faults',
          paint: {
            'line-color': '#ff2a6d',
            'line-width': 3.2,
            'line-blur': 1.2,
            'line-opacity': 0.85
          }
        });

        // 3. Núcleo láser brillante discontinuo
        this.map.addLayer({
          id: 'faults-laser-core',
          type: 'line',
          source: 'geological-faults',
          paint: {
            'line-color': '#ffffff',
            'line-width': 1.2,
            'line-dasharray': [4, 3],
            'line-opacity': 0.95
          }
        });
      },
      error: (e) => console.warn('Fallas no cargadas:', e)
    });
  }

  setCameraPreset(preset: 'todo' | 'trinchera' | 'norte' | 'sur') {
    if (!this.map) return;
    this.activePreset.set(preset);

    switch (preset) {
      case 'todo':
        this.map.flyTo({
          center: [-86.5, 13.5],
          zoom: 5.6,
          pitch: 0,
          bearing: 0,
          duration: 1800
        });
        this.is3DMode.set(false);
        break;
      case 'trinchera':
        this.map.flyTo({
          center: [-89.6, 12.8],
          zoom: 6.8,
          pitch: 58,
          bearing: 25,
          duration: 2000
        });
        this.is3DMode.set(true);
        break;
      case 'norte':
        this.map.flyTo({
          center: [-89.8, 14.1],
          zoom: 7.3,
          pitch: 46,
          bearing: -12,
          duration: 1800
        });
        this.is3DMode.set(true);
        break;
      case 'sur':
        this.map.flyTo({
          center: [-83.6, 9.3],
          zoom: 7.3,
          pitch: 46,
          bearing: 16,
          duration: 1800
        });
        this.is3DMode.set(true);
        break;
    }
  }

  toggle3DMode() {
    if (!this.map) return;
    const new3D = !this.is3DMode();
    this.is3DMode.set(new3D);
    this.map.easeTo({
      pitch: new3D ? 54 : 0,
      bearing: new3D ? -15 : 0,
      duration: 1400
    });
  }

  private updateMapData(features: GeoJsonFeature[]) {
    if (!this.map || !this.map.isStyleLoaded()) return;

    const source = this.map.getSource('earthquakes') as GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: features
      });
    }
  }

  private updateCitizenClustersLayer(clusters: any) {
    if (!this.map || !this.map.isStyleLoaded()) return;
    const source = this.map.getSource('citizen-reports-clusters') as GeoJSONSource;
    if (source) {
      source.setData(clusters || { type: 'FeatureCollection', features: [] });
    }
  }

  private toggleHeatmapVisibility(visible: boolean) {
    if (!this.map || !this.map.isStyleLoaded()) return;
    this.map.setLayoutProperty('earthquakes-heat', 'visibility', visible ? 'visible' : 'none');
  }

  private animateNewEvent(feature: GeoJsonFeature) {
    if (!this.map) return;
    const coords = [feature.geometry.coordinates[0], feature.geometry.coordinates[1]] as [number, number];
    const mag = feature.properties.magnitude;

    // Alerta sonora acústica sintetizada con Web Audio API
    this.audioService.playEarthquakeAlert(mag);

    // Disparar aguja del osciloscopio en el HUD
    this.seismographHud?.triggerSeismicSpike(mag);

    // Acercar suavemente la cámara al nuevo epicentro
    this.map.easeTo({
      center: coords,
      duration: 1400
    });
  }
}
