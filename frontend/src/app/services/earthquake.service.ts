import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  EarthquakeDetail,
  EarthquakeFilter,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  SeismicIntelligenceReport
} from '../models/earthquake.model';

@Injectable({
  providedIn: 'root'
})
export class EarthquakeService {
  private http = inject(HttpClient);

  // Estados Reactivos con Angular Signals
  readonly earthquakes = signal<GeoJsonFeature[]>([]);
  readonly selectedEarthquake = signal<EarthquakeDetail | null>(null);
  readonly filters = signal<EarthquakeFilter>({ minMagnitude: 0, daysBack: 7 });
  readonly isHeatmapActive = signal<boolean>(false);
  readonly activeTheme = signal<'dark' | 'light'>('dark');
  readonly loading = signal<boolean>(false);

  // Estado de la Línea de Tiempo
  readonly timelinePlaying = signal<boolean>(false);
  readonly timelineCurrentTime = signal<number | null>(null); // Epoch millis
  readonly latestNewEvent = signal<GeoJsonFeature | null>(null);

  // Sismos filtrados reactivamente por magnitud, país y línea de tiempo
  readonly filteredEarthquakes = computed(() => {
    const list = this.earthquakes();
    const currentFilter = this.filters();
    const timelineTime = this.timelineCurrentTime();

    return list.filter(item => {
      // Filtro por magnitud
      if (item.properties.magnitude < currentFilter.minMagnitude) {
        return false;
      }
      // Filtro por profundidad
      if (currentFilter.maxDepth && item.properties.depth > currentFilter.maxDepth) {
        return false;
      }
      // Filtro temporal interactivo (Timeline scrubber)
      if (timelineTime !== null) {
        const eventTime = new Date(item.properties.time).getTime();
        if (eventTime > timelineTime) {
          return false;
        }
      }
      return true;
    });
  });

  // Conteo de sismos visibles y sismo mayor
  readonly totalVisibleCount = computed(() => this.filteredEarthquakes().length);

  readonly maxMagnitudeEvent = computed(() => {
    const list = this.filteredEarthquakes();
    if (list.length === 0) return null;
    return list.reduce((max, current) =>
      current.properties.magnitude > max.properties.magnitude ? current : max
    );
  });

  loadRecentEarthquakes(): Observable<GeoJsonFeatureCollection> {
    this.loading.set(true);
    return this.http.get<GeoJsonFeatureCollection>(`${environment.apiUrl}/earthquakes/recent`).pipe(
      tap({
        next: (data) => {
          this.earthquakes.set(data.features || []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      })
    );
  }

  loadFilteredEarthquakes(filter: EarthquakeFilter): Observable<GeoJsonFeatureCollection> {
    this.loading.set(true);
    this.filters.set(filter);

    let params = new HttpParams()
      .set('minMagnitude', filter.minMagnitude.toString());

    if (filter.daysBack) {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - filter.daysBack);
      params = params.set('since', sinceDate.toISOString());
    }

    return this.http.get<GeoJsonFeatureCollection>(`${environment.apiUrl}/earthquakes`, { params }).pipe(
      tap({
        next: (data) => {
          this.earthquakes.set(data.features || []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      })
    );
  }

  getFaults(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/faults`);
  }

  getEarthquakeDetail(id: string): Observable<EarthquakeDetail> {
    return this.http.get<EarthquakeDetail>(`${environment.apiUrl}/earthquakes/${id}`).pipe(
      tap(detail => this.selectedEarthquake.set(detail))
    );
  }

  getIntelligenceReport(id: string): Observable<SeismicIntelligenceReport> {
    return this.http.get<SeismicIntelligenceReport>(`${environment.apiUrl}/earthquakes/${id}/intelligence-report`);
  }

  readonly selectedCitizenClusters = signal<GeoJsonFeatureCollection | null>(null);

  addOrUpdateEarthquake(feature: GeoJsonFeature) {
    this.earthquakes.update(currentList => {
      const index = currentList.findIndex(e => e.id === feature.id);
      if (index >= 0) {
        const updated = [...currentList];
        updated[index] = feature;
        return updated;
      }
      return [feature, ...currentList];
    });

    // Guardar referencia al último sismo en vivo para animación de pulso
    this.latestNewEvent.set(feature);
  }

  selectEarthquake(id: string) {
    this.getEarthquakeDetail(id).subscribe();
    this.getCitizenClusters(id).subscribe({
      next: (clusters) => this.selectedCitizenClusters.set(clusters),
      error: () => this.selectedCitizenClusters.set(null)
    });
  }

  clearSelectedEarthquake() {
    this.selectedEarthquake.set(null);
    this.selectedCitizenClusters.set(null);
  }

  getCitizenClusters(eventId: string): Observable<GeoJsonFeatureCollection> {
    return this.http.get<GeoJsonFeatureCollection>(`${environment.apiUrl}/earthquakes/${eventId}/reports/clusters`);
  }

  updateCitizenReport(eventId: string, totalReports: number, averageIntensity: number) {
    const current = this.selectedEarthquake();
    if (current && current.id === eventId) {
      this.selectedEarthquake.set({
        ...current,
        totalCitizenReports: totalReports,
        averagePerceivedIntensity: averageIntensity
      });
      this.getCitizenClusters(eventId).subscribe({
        next: (clusters) => this.selectedCitizenClusters.set(clusters)
      });
    }
  }

  toggleHeatmap() {
    this.isHeatmapActive.update(v => !v);
  }

  toggleTheme() {
    this.activeTheme.update(t => t === 'dark' ? 'light' : 'dark');
  }
}

