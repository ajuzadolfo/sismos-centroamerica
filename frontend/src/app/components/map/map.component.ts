import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Map, GeoJSONSource, Popup, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
import { EarthquakeService } from '../../services/earthquake.service';
import { environment } from '../../../environments/environment';
import { GeoJsonFeature } from '../../models/earthquake.model';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-wrapper">
      <div #mapContainer class="map-container"></div>

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
          <div class="legend-item"><span class="dot mag-low"></span> &lt; 3.5</div>
          <div class="legend-item"><span class="dot mag-med"></span> 3.5 - 4.4</div>
          <div class="legend-item"><span class="dot mag-high"></span> 4.5 - 5.9</div>
          <div class="legend-item"><span class="dot mag-major"></span> &ge; 6.0</div>
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

    .loading-overlay {
      position: absolute;
      top: 96px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-primary);
      z-index: 50;
    }

    .spinner {
      width: 16px;
      height: 16px;
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
      bottom: 100px;
      right: 16px;
      padding: 12px 16px;
      z-index: 50;
      font-size: 0.75rem;
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
  `]
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  earthquakeService = inject(EarthquakeService);
  private map: Map | null = null;
  private activePopup: Popup | null = null;

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

    // Efecto para animar nuevos sismos recibidos en vivo
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
    setWorkerUrl('/maplibre-gl-worker.mjs');

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
      this.setupLayers();
      this.loadGeologicalFaults();
      this.earthquakeService.loadRecentEarthquakes().subscribe();
    });
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

    // 3. Capa de Círculos Agrupados (Clusters)
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

    // 4. Conteo numérico dentro del cluster
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

    // 5. Capa de Puntos Individuales (Sismos no agrupados)
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
        'circle-opacity': 0.9
      }
    });

    // 6. Capa de Reportes Ciudadanos Comunitarios ("¿Lo sentiste?")
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

    // Eventos del mapa
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

    // Clic en sismo individual: abrir popup y seleccionar evento
    this.map.on('click', 'unclustered-point', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const coords = (feature.geometry as any).coordinates.slice();
      const props = feature.properties;

      this.earthquakeService.selectEarthquake(feature.id as string);

      const timeStr = new Date(props['time']).toLocaleString('es', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      const popupHtml = `
        <div style="font-family: Outfit, sans-serif; min-width: 180px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-weight: 800; font-size: 1.1rem; color: #00f0ff;">M ${Number(props['magnitude']).toFixed(1)}</span>
            <span style="font-size: 0.75rem; color: #94a3b8; font-family: monospace;">${Number(props['depth']).toFixed(1)} km</span>
          </div>
          <div style="font-weight: 600; font-size: 0.85rem; color: #f8fafc; margin-bottom: 4px;">
            ${props['place'] || props['title']}
          </div>
          <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 10px;">
            ${timeStr}
          </div>
          <button id="popup-report-btn" style="
            width: 100%;
            padding: 6px 12px;
            background: linear-gradient(135deg, #00f0ff 0%, #0284c7 100%);
            border: none;
            border-radius: 6px;
            color: #020617;
            font-weight: 700;
            font-size: 0.75rem;
            cursor: pointer;
          ">¿Lo sentiste? Reportar</button>
        </div>
      `;

      if (this.activePopup) this.activePopup.remove();

      this.activePopup = new Popup({ offset: 12, closeButton: true })
        .setLngLat(coords)
        .setHTML(popupHtml)
        .addTo(this.map!);

      // Escuchar clic en el botón del popup
      setTimeout(() => {
        const btn = document.getElementById('popup-report-btn');
        if (btn) {
          btn.onclick = () => {
            this.earthquakeService.selectEarthquake(feature.id as string);
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

        this.map.addLayer({
          id: 'faults-lines',
          type: 'line',
          source: 'geological-faults',
          paint: {
            'line-color': '#f43f5e',
            'line-width': 1.8,
            'line-dasharray': [3, 2],
            'line-opacity': 0.75
          }
        });
      },
      error: (e) => console.warn('Fallas no cargadas:', e)
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

    this.map.easeTo({
      center: coords,
      duration: 1200
    });
  }
}

