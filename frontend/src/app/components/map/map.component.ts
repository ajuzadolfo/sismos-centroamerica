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
import { TranslationService } from '../../services/translation.service';
import { ShakeMapService } from '../../services/shakemap.service';
import { SeismographHudComponent } from './seismograph-hud.component';
import { environment } from '../../../environments/environment';
import { GeoJsonFeature } from '../../models/earthquake.model';

const VOLCANOES_DATA = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, properties: { name: 'Volcán Tajumulco (4,220 m)' }, geometry: { type: 'Point' as const, coordinates: [-91.903, 15.044] } },
    { type: 'Feature' as const, properties: { name: 'Volcán de Fuego (3,763 m)' }, geometry: { type: 'Point' as const, coordinates: [-90.880, 14.474] } },
    { type: 'Feature' as const, properties: { name: 'Volcán Pacaya (2,552 m)' }, geometry: { type: 'Point' as const, coordinates: [-90.601, 14.381] } },
    { type: 'Feature' as const, properties: { name: 'Volcán Santa Ana (2,381 m)' }, geometry: { type: 'Point' as const, coordinates: [-89.630, 13.853] } },
    { type: 'Feature' as const, properties: { name: 'Volcán San Salvador (1,893 m)' }, geometry: { type: 'Point' as const, coordinates: [-89.283, 13.734] } },
    { type: 'Feature' as const, properties: { name: 'Volcán San Miguel (2,130 m)' }, geometry: { type: 'Point' as const, coordinates: [-88.271, 13.434] } },
    { type: 'Feature' as const, properties: { name: 'Volcán Momotombo (1,297 m)' }, geometry: { type: 'Point' as const, coordinates: [-86.540, 12.423] } },
    { type: 'Feature' as const, properties: { name: 'Volcán Masaya (635 m)' }, geometry: { type: 'Point' as const, coordinates: [-86.161, 11.984] } },
    { type: 'Feature' as const, properties: { name: 'Volcán Arenal (1,670 m)' }, geometry: { type: 'Point' as const, coordinates: [-84.703, 10.463] } },
    { type: 'Feature' as const, properties: { name: 'Volcán Irazú (3,432 m)' }, geometry: { type: 'Point' as const, coordinates: [-83.852, 9.979] } },
    { type: 'Feature' as const, properties: { name: 'Volcán Barú (3,474 m)' }, geometry: { type: 'Point' as const, coordinates: [-82.542, 8.808] } }
  ]
};


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

      <!-- Barra Flotante de Modos de Cámara y Presets 3D Avanzados -->
      <div class="camera-bar glass-panel">
        <span class="camera-title">{{ transService.tr().camera.title }}</span>
        <div class="preset-buttons">
          <button
            class="preset-btn"
            [class.active]="activePreset() === 'todo'"
            (click)="setCameraPreset('todo')"
            [title]="transService.tr().camera.allTitle">
            {{ transService.tr().camera.all }}
          </button>
          <button
            class="preset-btn"
            [class.active]="activePreset() === 'trinchera'"
            (click)="setCameraPreset('trinchera')"
            [title]="transService.tr().camera.trenchTitle">
            {{ transService.tr().camera.trench }}
          </button>
          <button
            class="preset-btn"
            [class.active]="activePreset() === 'norte'"
            (click)="setCameraPreset('norte')"
            [title]="transService.tr().camera.northTitle">
            {{ transService.tr().camera.north }}
          </button>
          <button
            class="preset-btn"
            [class.active]="activePreset() === 'sur'"
            (click)="setCameraPreset('sur')"
            [title]="transService.tr().camera.southTitle">
            {{ transService.tr().camera.south }}
          </button>
        </div>

        <button
          class="orbit-btn"
          [class.active]="isOrbitActive()"
          (click)="toggleOrbitTour()"
          [title]="transService.tr().camera.orbitTitle">
          <span class="orbit-icon">🔄</span>
          <span>{{ isOrbitActive() ? transService.tr().camera.orbitOn : transService.tr().camera.orbitOff }}</span>
        </button>

        <button
          class="tilt-toggle-btn"
          [class.active]="is3DMode()"
          (click)="toggle3DMode()"
          [title]="transService.tr().camera.tiltTitle">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          <span>{{ is3DMode() ? transService.tr().camera.mode3d : transService.tr().camera.mode2d }}</span>
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
          <span>{{ transService.tr().hud.loadingSync }}</span>
        </div>
      }

      <!-- Leyenda de Magnitud -->
      <div class="legend-panel glass-panel">
        <div class="legend-title">{{ transService.tr().legend.title }}</div>
        <div class="legend-items">
          <div class="legend-item"><span class="dot mag-low"></span> {{ transService.tr().legend.minor }}</div>
          <div class="legend-item"><span class="dot mag-med"></span> {{ transService.tr().legend.moderate }}</div>
          <div class="legend-item"><span class="dot mag-high"></span> {{ transService.tr().legend.strong }}</div>
          <div class="legend-item"><span class="dot mag-major"></span> {{ transService.tr().legend.major }}</div>
          <div class="legend-divider"></div>
          <div class="legend-item"><span class="hazard-stripe"></span> {{ transService.tr().legend.faults }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .map-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      height: 100dvh;
      overflow: hidden;
    }

    :host ::ng-deep .maplibregl-ctrl-bottom-left,
    :host ::ng-deep .maplibregl-ctrl-bottom-right {
      bottom: 108px !important;
      z-index: 20;
    }

    @media (max-width: 768px) {
      :host ::ng-deep .maplibregl-ctrl-bottom-left {
        display: none !important;
      }
      :host ::ng-deep .maplibregl-ctrl-bottom-right {
        bottom: 86px !important;
        transform: scale(0.75);
        transform-origin: bottom right;
      }
      :host ::ng-deep .maplibregl-ctrl-attrib {
        background-color: rgba(3, 7, 18, 0.75) !important;
        padding: 1px 4px !important;
        border-radius: 4px;
      }
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
      gap: 8px;
      padding: 6px 14px;
      z-index: 50;
      border-radius: 30px;
      background: rgba(8, 14, 26, 0.88);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(0, 240, 255, 0.28);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 18px rgba(0, 240, 255, 0.15);
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

    .orbit-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      border-radius: 20px;
      color: #6ee7b7;
      font-size: 0.7rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: var(--font-sans);
    }

    .orbit-btn:hover {
      background: rgba(16, 185, 129, 0.22);
      color: #ffffff;
    }

    .orbit-btn.active {
      background: rgba(16, 185, 129, 0.3);
      border-color: #10b981;
      color: #a7f3d0;
      box-shadow: 0 0 14px rgba(16, 185, 129, 0.4);
    }

    .orbit-icon {
      font-size: 0.75rem;
      animation: spin-slow 8s linear infinite;
    }

    @keyframes spin-slow {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
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
      bottom: 114px;
      right: 16px;
      padding: 12px 16px;
      z-index: 40;
      font-size: 0.75rem;
      background: rgba(8, 14, 26, 0.85);
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

    .legend-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 4px 0;
    }

    .hazard-stripe {
      width: 14px;
      height: 8px;
      border-radius: 2px;
      background: repeating-linear-gradient(
        -45deg,
        #ffd600,
        #ffd600 3px,
        #000000 3px,
        #000000 6px
      );
      box-shadow: 0 0 6px rgba(255, 214, 0, 0.45);
      border: 1px solid rgba(0, 0, 0, 0.7);
      flex-shrink: 0;
    }

    .legend-tip {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 0.62rem;
      color: #94a3b8;
      font-style: italic;
    }

    @media (max-width: 768px) {
      .camera-bar {
        top: 62px;
        left: 8px;
        right: 8px;
        transform: none;
        max-width: calc(100vw - 16px);
        width: auto;
        overflow-x: auto;
        overflow-y: hidden;
        white-space: nowrap;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
        padding: 3px 6px;
        gap: 4px;
        justify-content: flex-start;
      }
      .camera-bar::-webkit-scrollbar {
        display: none;
      }
      .camera-title {
        display: none;
      }
      .preset-buttons {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
      }
      .preset-btn {
        padding: 3px 6px;
        font-size: 0.64rem;
        flex-shrink: 0;
      }
      .orbit-btn {
        padding: 3px 6px;
        font-size: 0.64rem;
        flex-shrink: 0;
      }
      .tilt-toggle-btn {
        padding: 3px 6px;
        font-size: 0.64rem;
        flex-shrink: 0;
      }

      .legend-panel {
        display: none;
      }
    }
  `]
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('seismographHud') seismographHud?: SeismographHudComponent;

  earthquakeService = inject(EarthquakeService);
  audioService = inject(AudioAlertService);
  transService = inject(TranslationService);
  shakeMapService = inject(ShakeMapService);

  private map: Map | null = null;
  private activePopup: Popup | null = null;

  // Estados de Telemetría y Controles de Cámara 3D
  coordinatesText = signal<string>('13.50° N, 86.50° W');
  pitchText = signal<string>('0° [2D]');
  is3DMode = signal<boolean>(false);
  isOrbitActive = signal<boolean>(false);
  activePreset = signal<'todo' | 'trinchera' | 'norte' | 'sur'>('todo');

  private orbitAnimationId: number | null = null;

  constructor() {
    // Efecto reactivo con Angular Signals: actualiza sismos y columnas 3D
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

    // Efecto para visualizar las isolíneas de atenuación ShakeMap (MMI) del sismo seleccionado
    effect(() => {
      const selected = this.earthquakeService.selectedEarthquake();
      if (this.map && this.map.getSource('shakemap-bands')) {
        const source = this.map.getSource('shakemap-bands') as GeoJSONSource;
        if (selected) {
          const shakeResult = this.shakeMapService.generateShakeMap(
            selected.longitude,
            selected.latitude,
            selected.magnitude,
            selected.depth,
            this.transService.currentLang() === 'en' ? 'en' : 'es'
          );
          source.setData(shakeResult.geojsonBands);
        } else {
          source.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    });
  }

  ngOnInit() {
    this.initMap();
  }

  ngOnDestroy() {
    this.stopOrbitLoop();
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
      maxZoom: 16,
      maxPitch: 75
    });

    this.map.addControl(new NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
    this.map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    this.map.on('load', () => {
      this.initAnimatedPulseIcons();
      this.setup3DTerrain();
      this.setupLayers();
      this.loadGeologicalFaults();
      this.loadVolcanicArc();

      // Renderizado inmediato de sismos en cuanto el mapa esté listo
      const current = this.earthquakeService.filteredEarthquakes();
      if (current.length > 0) {
        this.updateMapData(current);
      }

      // Cargar/actualizar catálogo sísmico desde el backend
      this.earthquakeService.loadRecentEarthquakes().subscribe({
        next: () => {
          this.updateMapData(this.earthquakeService.filteredEarthquakes());
        }
      });
    });

    // Detener órbita al interactuar manualmente con el mapa
    this.map.on('dragstart', () => {
      if (this.isOrbitActive()) {
        this.toggleOrbitTour();
      }
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
      const is3D = pitch > 15;
      this.is3DMode.set(is3D);
      this.pitchText.set(`${pitch}° [${is3D ? '3D' : '2D'}]`);
    };

    this.map.on('pitchend', updateCameraState);
    this.map.on('rotateend', updateCameraState);
  }

  private setup3DTerrain() {
    if (!this.map) return;

    try {
      // 1. Fuente Raster-DEM de elevación física global en formato Terrarium
      this.map.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize: 256,
        encoding: 'terrarium',
        maxzoom: 12
      });

      // 2. Activar relieve físico con exageración para apreciar cordilleras y volcanes en 3D
      this.map.setTerrain({
        source: 'terrain-dem',
        exaggeration: 1.85
      });

      // 3. Atmósfera de horizonte y cielo cinemático
      if (typeof (this.map as any).setSky === 'function') {
        (this.map as any).setSky({
          'sky-color': '#020617',
          'sky-horizon-blend': 0.6,
          'horizon-color': '#00f0ff',
          'horizon-fog-blend': 0.75,
          'fog-color': '#080e1a',
          'fog-ground-blend': 0.5
        });
      }
    } catch (err) {
      console.warn('3D Terrain setup:', err);
    }
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

    // 1. Fuente GeoJSON de sismos con clustering (inicializada con datos inmediatos si ya existen)
    const currentFeatures = this.earthquakeService.filteredEarthquakes();
    const initialFeatures = currentFeatures.map(f => ({
      ...f,
      properties: { ...f.properties, id: f.id, eventId: f.id }
    }));

    this.map.addSource('earthquakes', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: initialFeatures },
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 40
    });


    // 5. Capa de Mapa de Calor (Heatmap)
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

    // 6. ONDAS SÍSMICAS ANIMADAS (P & S shockwave rings)
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

    // 7. Capa de Círculos Agrupados (Clusters)
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

    // 8. Conteo numérico dentro del cluster
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

    // 9. Capa de Puntos Individuales en superficie
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

    // 10. Capa de Reportes Ciudadanos Comunitarios ("¿Lo sentiste?")
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

    // 11. Capa de Atenuación Sísmica ShakeMap (MMI - Isolínas de Impacto Instrumental)
    this.map.addSource('shakemap-bands', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    const beforePointId = this.map.getLayer('unclustered-point') ? 'unclustered-point' : undefined;

    this.map.addLayer({
      id: 'shakemap-bands-fill',
      type: 'fill',
      source: 'shakemap-bands',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['get', 'opacity']
      }
    }, beforePointId);

    this.map.addLayer({
      id: 'shakemap-bands-line',
      type: 'line',
      source: 'shakemap-bands',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
        'line-opacity': 0.7,
        'line-dasharray': [3, 2]
      }
    }, beforePointId);

    // Eventos interactivos del mapa
    this.registerMapEvents();
  }

  private loadVolcanicArc() {
    if (!this.map) return;

    this.map.addSource('volcanic-arc', {
      type: 'geojson',
      data: VOLCANOES_DATA
    });

    this.map.addLayer({
      id: 'volcanoes-cone-halo',
      type: 'circle',
      source: 'volcanic-arc',
      paint: {
        'circle-radius': 7,
        'circle-color': '#ff6d00',
        'circle-opacity': 0.45,
        'circle-blur': 0.5
      }
    });

    this.map.addLayer({
      id: 'volcanoes-cone-core',
      type: 'circle',
      source: 'volcanic-arc',
      paint: {
        'circle-radius': 3.5,
        'circle-color': '#ffea00',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff'
      }
    });

    this.map.addLayer({
      id: 'volcanoes-label',
      type: 'symbol',
      source: 'volcanic-arc',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': 9,
        'text-offset': [0, 1.2],
        'text-anchor': 'top'
      },
      paint: {
        'text-color': '#f8fafc',
        'text-halo-color': '#020617',
        'text-halo-width': 1.5
      }
    });
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
      // Resolver el ID real del sismo evitando el ID numérico 0 asignado por MapLibre Supercluster
      const propsId = props['id'] || props['eventId'];
      let selectedId: string | null = (propsId && propsId !== '0') ? String(propsId) : null;
      if (!selectedId && typeof feature.id === 'string' && feature.id !== '0' && isNaN(Number(feature.id))) {
        selectedId = feature.id;
      }
      if (!selectedId) {
        const match = this.earthquakeService.earthquakes().find(eq =>
          Math.abs(eq.geometry.coordinates[0] - coords[0]) < 0.005 &&
          Math.abs(eq.geometry.coordinates[1] - coords[1]) < 0.005
        );
        if (match) selectedId = match.id;
      }

      // Establecer de inmediato el sismo seleccionado de forma síncrona para activación instantánea del ShakeMap
      const baseDetail = {
        id: selectedId || String(feature.id),
        title: props['title'] || props['place'] || (this.transService.currentLang() === 'en' ? 'Central America Earthquake' : 'Sismo en Centroamérica'),
        place: props['place'] || props['title'],
        time: props['time'] || new Date().toISOString(),
        updatedAt: props['updatedAt'],
        magnitude: mag,
        magnitudeType: props['magnitudeType'] || 'Mw',
        depth: depth,
        status: props['status'] || 'REVIEWED',
        alertLevel: props['alertLevel'],
        significance: Number(props['significance']) || 0,
        tsunamiAlert: props['tsunamiAlert'] === true || props['tsunamiAlert'] === 'true',
        latitude: coords[1],
        longitude: coords[0],
        totalCitizenReports: 0
      };
      this.earthquakeService.selectedEarthquake.set(baseDetail as any);

      if (selectedId) {
        this.earthquakeService.selectEarthquake(selectedId);
      }
      this.seismographHud?.triggerSeismicSpike(mag);
      if (this.map) {
        this.map.flyTo({ center: coords, zoom: Math.max(this.map.getZoom(), 7.0), speed: 1.1 });
      }

      const dateObj = new Date(props['time']);
      const caDate = dateObj.toLocaleDateString('es', {
        timeZone: 'America/Guatemala',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const caHour = dateObj.toLocaleTimeString('es', {
        timeZone: 'America/Guatemala',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const caFormatted = `${caDate}, ${caHour}`;

      const utcDate = dateObj.toLocaleDateString('es', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const utcHour = dateObj.toLocaleTimeString('es', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const utcFormatted = `${utcDate}, ${utcHour} UTC`;

      const magColor = mag < 3.5 ? '#00e676' : (mag < 4.5 ? '#ffea00' : (mag < 6.0 ? '#ff9100' : '#ff1744'));

      const popupHtml = `
        <div style="font-family: Outfit, sans-serif; width: 298px; max-width: min(330px, calc(100vw - 40px)); padding: 2px;">
          <!-- Cabecera de Magnitud y Profundidad -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-weight: 800; font-size: 1.25rem; color: ${magColor}; letter-spacing: -0.02em;">
              M ${mag.toFixed(1)}
            </span>
            <span style="font-size: 0.72rem; color: #94a3b8; font-family: monospace; background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px;">
              ${depth.toFixed(1)} km ${this.transService.tr().popup.depth}
            </span>
          </div>

          <!-- Barra de Profundidad -->
          <div style="background: rgba(255,255,255,0.08); height: 4px; border-radius: 2px; margin-bottom: 10px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #00f0ff, #8b5cf6); width: ${Math.min(100, (depth / 150) * 100)}%; height: 100%;"></div>
          </div>

          <!-- Título del Epicentro -->
          <div style="font-weight: 600; font-size: 0.88rem; color: #f8fafc; margin-bottom: 10px; line-height: 1.35;">
            ${props['place'] || props['title']}
          </div>

          <!-- Marcas Temporales Ajustadas (24h sin saltos de línea) -->
          <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 8px 10px; margin-bottom: 12px; font-size: 0.72rem; font-family: monospace;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
              <span style="color: #64748b; font-weight: 700; font-size: 0.64rem; letter-spacing: 0.04em;">${this.transService.tr().popup.localTime}</span>
              <span style="color: #f1f5f9; font-weight: 600;">${caFormatted}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #00f0ff; font-weight: 700; font-size: 0.64rem; letter-spacing: 0.04em;">${this.transService.tr().popup.utcTime}</span>
              <span style="color: #94a3b8; font-weight: 600;">${utcFormatted}</span>
            </div>
          </div>

          <!-- Botón de Reporte Ciudadano a Ancho Completo -->
          <button id="popup-report-btn" style="
            width: 100%;
            padding: 8px 12px;
            background: linear-gradient(135deg, #00f0ff 0%, #0284c7 100%);
            border: none;
            border-radius: 8px;
            color: #020617;
            font-weight: 700;
            font-size: 0.8rem;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0, 240, 255, 0.25);
            transition: transform 0.15s ease;
          ">${this.transService.tr().popup.reportBtn}</button>
        </div>
      `;

      if (this.activePopup) this.activePopup.remove();

      this.activePopup = new Popup({ offset: 12, closeButton: true, maxWidth: '360px' })
        .setLngLat(coords)
        .setHTML(popupHtml)
        .addTo(this.map!);

      // Escuchar evento de reporte ciudadano
      setTimeout(() => {
        const reportBtn = document.getElementById('popup-report-btn');
        if (reportBtn && selectedId) {
          reportBtn.onclick = () => {
            this.earthquakeService.selectEarthquake(selectedId!);
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

        // 1. Resplandor difuso de precaución/advertencia (Hazard Glow)
        this.map.addLayer({
          id: 'faults-hazard-glow',
          type: 'line',
          source: 'geological-faults',
          paint: {
            'line-color': '#ffd600',
            'line-width': 9,
            'line-blur': 6,
            'line-opacity': 0.45
          }
        });

        // 2. Base de contraste negro de seguridad (Black Border Casing)
        this.map.addLayer({
          id: 'faults-black-casing',
          type: 'line',
          source: 'geological-faults',
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#000000',
            'line-width': 5.4,
            'line-opacity': 0.95
          }
        });

        // 3. Pista amarilla continua de alta visibilidad (Caution Yellow Core)
        this.map.addLayer({
          id: 'faults-yellow-track',
          type: 'line',
          source: 'geological-faults',
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#ffd600',
            'line-width': 3.4,
            'line-opacity': 1.0
          }
        });

        // 4. Franjas negras discontinuas de advertencia industrial (Hazard Caution Stripes)
        this.map.addLayer({
          id: 'faults-hazard-stripes',
          type: 'line',
          source: 'geological-faults',
          layout: {
            'line-cap': 'square',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#000000',
            'line-width': 3.4,
            'line-dasharray': [2.5, 2.5],
            'line-opacity': 1.0
          }
        });
      },
      error: (e) => console.warn('Fallas no cargadas:', e)
    });
  }

  setCameraPreset(preset: 'todo' | 'trinchera' | 'norte' | 'sur') {
    if (!this.map) return;
    this.stopOrbitLoop();
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
          zoom: 7.0,
          pitch: 62,
          bearing: 25,
          duration: 2000
        });
        this.is3DMode.set(true);
        break;
      case 'norte':
        this.map.flyTo({
          center: [-89.8, 14.1],
          zoom: 7.5,
          pitch: 58,
          bearing: -14,
          duration: 1800
        });
        this.is3DMode.set(true);
        break;
      case 'sur':
        this.map.flyTo({
          center: [-83.6, 9.3],
          zoom: 7.5,
          pitch: 58,
          bearing: 18,
          duration: 1800
        });
        this.is3DMode.set(true);
        break;
    }
  }

  toggle3DMode() {
    if (!this.map) return;
    this.stopOrbitLoop();
    const new3D = !this.is3DMode();
    this.is3DMode.set(new3D);
    this.map.easeTo({
      pitch: new3D ? 60 : 0,
      bearing: new3D ? -15 : 0,
      duration: 1400
    });
  }

  toggleOrbitTour() {
    if (!this.map) return;
    const active = !this.isOrbitActive();
    this.isOrbitActive.set(active);

    if (active) {
      this.is3DMode.set(true);
      this.map.easeTo({
        pitch: 62,
        zoom: Math.max(this.map.getZoom(), 6.6),
        duration: 1200
      });
      this.startOrbitLoop();
    } else {
      this.stopOrbitLoop();
    }
  }

  private startOrbitLoop() {
    this.stopOrbitLoop();
    const rotateStep = () => {
      if (!this.isOrbitActive() || !this.map) return;
      this.map.setBearing((this.map.getBearing() + 0.15) % 360);
      this.orbitAnimationId = requestAnimationFrame(rotateStep);
    };
    this.orbitAnimationId = requestAnimationFrame(rotateStep);
  }

  private stopOrbitLoop() {
    if (this.orbitAnimationId) {
      cancelAnimationFrame(this.orbitAnimationId);
      this.orbitAnimationId = null;
    }
    this.isOrbitActive.set(false);
  }

  private updateMapData(features: GeoJsonFeature[]) {
    if (!this.map) return;

    const source = this.map.getSource('earthquakes') as GeoJSONSource;
    if (source) {
      // Actualizar fuente sismos general inyectando el ID en properties para evitar sobreescritura por clustering
      const enrichedFeatures = features.map(f => ({
        ...f,
        properties: {
          ...f.properties,
          id: f.id,
          eventId: f.id
        }
      }));

      source.setData({
        type: 'FeatureCollection',
        features: enrichedFeatures
      });
      return;
    }

    // Si la fuente 'earthquakes' aún no existe (las capas están inicializándose):
    if (this.map.loaded()) {
      setTimeout(() => this.updateMapData(features), 120);
    } else {
      this.map.once('load', () => this.updateMapData(features));
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
