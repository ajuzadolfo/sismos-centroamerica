import { Injectable } from '@angular/core';

export interface ShakeMapCityImpact {
  cityName: string;
  country: string;
  coordinates: [number, number]; // [lon, lat]
  distanceKm: number;
  estimatedMmi: number;
  intensityLabel: string;
  intensityColor: string;
}

export interface ShakeMapResult {
  epicentralMmi: number;
  epicentralLabel: string;
  epicentralColor: string;
  geojsonBands: any; // GeoJSON FeatureCollection
  impactedCities: ShakeMapCityImpact[];
}

const MAJOR_CITIES: { name: string; country: string; coords: [number, number] }[] = [
  { name: 'Ciudad de Guatemala', country: 'Guatemala', coords: [-90.513, 14.634] },
  { name: 'Quezaltenango', country: 'Guatemala', coords: [-91.518, 14.834] },
  { name: 'Escuintla', country: 'Guatemala', coords: [-90.785, 14.305] },
  { name: 'San Salvador', country: 'El Salvador', coords: [-89.218, 13.692] },
  { name: 'Santa Ana', country: 'El Salvador', coords: [-89.559, 13.994] },
  { name: 'San Miguel', country: 'El Salvador', coords: [-88.177, 13.483] },
  { name: 'Tegucigalpa', country: 'Honduras', coords: [-87.206, 14.072] },
  { name: 'San Pedro Sula', country: 'Honduras', coords: [-88.025, 15.504] },
  { name: 'Choluteca', country: 'Honduras', coords: [-87.195, 13.303] },
  { name: 'Managua', country: 'Nicaragua', coords: [-86.236, 12.114] },
  { name: 'León', country: 'Nicaragua', coords: [-86.878, 12.437] },
  { name: 'Rivas', country: 'Nicaragua', coords: [-85.826, 11.437] },
  { name: 'San José', country: 'Costa Rica', coords: [-84.090, 9.928] },
  { name: 'Alajuela', country: 'Costa Rica', coords: [-84.214, 10.016] },
  { name: 'Liberia', country: 'Costa Rica', coords: [-85.437, 10.635] },
  { name: 'Puntarenas', country: 'Costa Rica', coords: [-84.838, 9.976] },
  { name: 'Ciudad de Panamá', country: 'Panamá', coords: [-79.519, 8.982] },
  { name: 'David (Chiriquí)', country: 'Panamá', coords: [-82.430, 8.427] },
  { name: 'Santiago de Veraguas', country: 'Panamá', coords: [-80.982, 8.100] },
  { name: 'Belmopán', country: 'Belice', coords: [-88.767, 17.251] },
  { name: 'Ciudad de Belice', country: 'Belice', coords: [-88.197, 17.504] }
];

@Injectable({
  providedIn: 'root'
})
export class ShakeMapService {

  /**
   * Calcula la intensidad Mercalli Modificada (MMI) usando modelo de atenuación GMPE para Centroamérica
   * MMI = c1 + c2*M - c3*ln(R) - c4*R
   */
  calculateMmi(magnitude: number, depthKm: number, distanceKm: number): number {
    const depth = Math.max(5, depthKm || 10);
    const hypoDist = Math.sqrt(distanceKm * distanceKm + depth * depth);
    const rawMmi = 1.15 + 1.05 * magnitude - 1.42 * Math.log(hypoDist) - 0.0025 * hypoDist;
    return Math.max(1.0, Math.min(10.0, Number(rawMmi.toFixed(1))));
  }

  getMmiColor(mmi: number): string {
    if (mmi >= 8.0) return '#d00000'; // VIII+ Severo a Destructivo
    if (mmi >= 7.0) return '#ff5400'; // VII Muy Fuerte
    if (mmi >= 6.0) return '#ff9100'; // VI Fuerte
    if (mmi >= 5.0) return '#ffea00'; // V Moderado
    if (mmi >= 4.0) return '#70e000'; // IV Ligero
    if (mmi >= 3.0) return '#38b000'; // III Débil
    if (mmi >= 2.0) return '#00b4d8'; // II Casi imperceptible
    return '#48cae4';                // I Instrumental
  }

  getMmiLabel(mmi: number, lang: 'es' | 'en' = 'es'): string {
    if (mmi >= 8.0) return lang === 'es' ? 'VIII - Severo / Ruinoso' : 'VIII - Severe / Destructive';
    if (mmi >= 7.0) return lang === 'es' ? 'VII - Muy Fuerte' : 'VII - Very Strong';
    if (mmi >= 6.0) return lang === 'es' ? 'VI - Fuerte' : 'VI - Strong';
    if (mmi >= 5.0) return lang === 'es' ? 'V - Moderado' : 'V - Moderate';
    if (mmi >= 4.0) return lang === 'es' ? 'IV - Ligero' : 'IV - Light';
    if (mmi >= 3.0) return lang === 'es' ? 'III - Débil' : 'III - Weak';
    if (mmi >= 2.0) return lang === 'es' ? 'II - Apenas Perceptible' : 'II - Scarcely Felt';
    return lang === 'es' ? 'I - Instrumental' : 'I - Instrumental';
  }

  /**
   * Genera el resultado completo del ShakeMap con isolíneas GeoJSON y ciudades afectadas
   */
  generateShakeMap(
    centerLon: number,
    centerLat: number,
    magnitude: number,
    depthKm: number,
    lang: 'es' | 'en' = 'es'
  ): ShakeMapResult {
    const epicentralMmi = this.calculateMmi(magnitude, depthKm, 0);
    const epicentralColor = this.getMmiColor(epicentralMmi);
    const epicentralLabel = this.getMmiLabel(epicentralMmi, lang);

    // Calcular impacto en ciudades
    const impactedCities: ShakeMapCityImpact[] = [];
    for (const city of MAJOR_CITIES) {
      const dist = this.haversineDistanceKm(centerLat, centerLon, city.coords[1], city.coords[0]);
      const mmi = this.calculateMmi(magnitude, depthKm, dist);
      if (mmi >= 2.5) { // Solo registrar ciudades donde se haya percibido al menos levemente
        impactedCities.push({
          cityName: city.name,
          country: city.country,
          coordinates: city.coords,
          distanceKm: Math.round(dist),
          estimatedMmi: mmi,
          intensityLabel: this.getMmiLabel(mmi, lang),
          intensityColor: this.getMmiColor(mmi)
        });
      }
    }

    // Ordenar de mayor a menor intensidad
    impactedCities.sort((a, b) => b.estimatedMmi - a.estimatedMmi);

    // Generar anillos poligonales GeoJSON para diferentes umbrales Mercalli
    // Buscamos las distancias en km donde MMI cruza 6.0, 5.0, 4.0, 3.0, 2.0
    const bands = [
      { mmiTarget: 7.0, label: 'MMI VII+', color: '#ff5400', opacity: 0.35 },
      { mmiTarget: 6.0, label: 'MMI VI', color: '#ff9100', opacity: 0.28 },
      { mmiTarget: 5.0, label: 'MMI V', color: '#ffea00', opacity: 0.22 },
      { mmiTarget: 4.0, label: 'MMI IV', color: '#70e000', opacity: 0.16 },
      { mmiTarget: 3.0, label: 'MMI III', color: '#00b4d8', opacity: 0.10 }
    ];

    const features: any[] = [];

    // Iterar en orden inverso (los más grandes primero para superposición adecuada)
    for (const band of bands.reverse()) {
      if (epicentralMmi < band.mmiTarget) continue;
      const radiusKm = this.findRadiusForMmi(magnitude, depthKm, band.mmiTarget);
      if (radiusKm > 2) {
        features.push({
          type: 'Feature',
          properties: {
            mmi: band.mmiTarget,
            label: band.label,
            color: band.color,
            opacity: band.opacity,
            radiusKm: Math.round(radiusKm)
          },
          geometry: this.createCirclePolygon(centerLon, centerLat, radiusKm)
        });
      }
    }

    const geojsonBands = {
      type: 'FeatureCollection',
      features
    };

    return {
      epicentralMmi,
      epicentralLabel,
      epicentralColor,
      geojsonBands,
      impactedCities
    };
  }

  private findRadiusForMmi(magnitude: number, depthKm: number, targetMmi: number): number {
    let low = 0;
    let high = 1500;
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      const mmi = this.calculateMmi(magnitude, depthKm, mid);
      if (mmi > targetMmi) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return low;
  }

  private haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private createCirclePolygon(centerLon: number, centerLat: number, radiusKm: number, points = 64): any {
    const coords: [number, number][] = [];
    const distanceRadians = radiusKm / 6371;
    const centerLatRad = centerLat * (Math.PI / 180);
    const centerLonRad = centerLon * (Math.PI / 180);

    for (let i = 0; i <= points; i++) {
      const angle = (i * 2 * Math.PI) / points;
      const pointLatRad = Math.asin(
        Math.sin(centerLatRad) * Math.cos(distanceRadians) +
        Math.cos(centerLatRad) * Math.sin(distanceRadians) * Math.cos(angle)
      );
      const pointLonRad = centerLonRad + Math.atan2(
        Math.sin(angle) * Math.sin(distanceRadians) * Math.cos(centerLatRad),
        Math.cos(distanceRadians) - Math.sin(centerLatRad) * Math.sin(pointLatRad)
      );

      coords.push([
        Number((pointLonRad * (180 / Math.PI)).toFixed(5)),
        Number((pointLatRad * (180 / Math.PI)).toFixed(5))
      ]);
    }

    return {
      type: 'Polygon',
      coordinates: [coords]
    };
  }
}
