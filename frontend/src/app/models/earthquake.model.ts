export interface GeoJsonGeometry {
  type: string;
  coordinates: [number, number, number?]; // [lon, lat, depth?]
}

export interface EarthquakeProperties {
  title: string;
  place?: string;
  magnitude: number;
  magnitudeType?: string;
  depth: number;
  time: string;
  updatedAt?: string;
  status: string;
  alertLevel?: string;
  significance?: number;
  tsunamiAlert?: boolean;
}

export interface GeoJsonFeature {
  type: 'Feature';
  id: string;
  geometry: GeoJsonGeometry;
  properties: EarthquakeProperties;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface EarthquakeDetail {
  id: string;
  title: string;
  place?: string;
  time: string;
  updatedAt?: string;
  magnitude: number;
  magnitudeType?: string;
  depth: number;
  status: string;
  alertLevel?: string;
  significance?: number;
  tsunamiAlert?: boolean;
  latitude: number;
  longitude: number;
  totalCitizenReports: number;
  averagePerceivedIntensity?: number;
  intensityClusters?: any[];
}

export interface EarthquakeFilter {
  minMagnitude: number;
  daysBack: number;
  maxDepth?: number;
  country?: string;
}
