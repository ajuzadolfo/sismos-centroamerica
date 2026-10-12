import { Injectable, computed, signal } from '@angular/core';

export type Language = 'es' | 'en';

export interface Translations {
  header: {
    title: string;
    subtitle: string;
    events: string;
    maxMag: string;
    home: string;
    heatmap: string;
    filters: string;
  };
  camera: {
    title: string;
    all: string;
    allTitle: string;
    trench: string;
    trenchTitle: string;
    north: string;
    northTitle: string;
    south: string;
    southTitle: string;
    orbitOn: string;
    orbitOff: string;
    orbitTitle: string;
    mode3d: string;
    mode2d: string;
    tiltTitle: string;
  };
  hud: {
    stationName: string;
    stationSub: string;
    muteTitle: string;
    unmuteTitle: string;
    collapse: string;
    expand: string;
    signalStream: string;
    telemCoords: string;
    telemPitch: string;
    telemAmplitude: string;
    loadingSync: string;
  };
  legend: {
    title: string;
    minor: string;
    moderate: string;
    strong: string;
    major: string;
    faults: string;
  };
  popup: {
    depth: string;
    localTime: string;
    utcTime: string;
    reportBtn: string;
  };
  timeline: {
    play: string;
    pause: string;
    now: string;
    reset: string;
  };
  detail: {
    depth: string;
    status: string;
    coords: string;
    tsunami: string;
    tsunamiAlert: string;
    tsunamiNone: string;
    citizenTitle: string;
    citizenDesc: string;
    notFelt: string;
    weak: string;
    moderate: string;
    strong: string;
    avgIntensity: string;
    sendingReport: string;
    retry: string;
  };
  filters: {
    title: string;
    minMag: string;
    timePeriod: string;
    hours24: string;
    days7: string;
    days30: string;
    focalDepth: string;
    all: string;
    shallow: string;
    intermediate: string;
    resetBtn: string;
    applyBtn: string;
  };
  landing: {
    company: string;
    product: string;
    navCta: string;
    exploreCta: string;
    docsCta: string;
    scrollHint: string;
    skipLink: string;
    scenes: {
      badge: string;
      title: string;
      subtitle: string;
      desc: string;
      metricVal: string;
      metricLbl: string;
    }[];
  };
}

const ES_TRANSLATIONS: Translations = {
  header: {
    title: 'SISMOS CENTROAMÉRICA',
    subtitle: 'MONITOR SÍSMICO EN TIEMPO REAL',
    events: 'EVENTOS',
    maxMag: 'MAG. MÁXIMA',
    home: 'Inicio',
    heatmap: 'Heatmap',
    filters: 'Filtros avanzados'
  },
  camera: {
    title: 'CENTRO 3D',
    all: '🌐 Todo',
    allTitle: 'Vista global de Centroamérica',
    trench: '🌋 Fosa 3D',
    trenchTitle: 'Perspectiva 3D con relieve sobre la Fosa Mesoamericana',
    north: '🇬🇹 Norte',
    northTitle: 'Enfocar relieve de Guatemala y El Salvador',
    south: '🇨🇷 Sur',
    southTitle: 'Enfocar relieve de Costa Rica y Panamá',
    orbitOn: 'ÓRBITA ON',
    orbitOff: 'ÓRBITA',
    orbitTitle: 'Iniciar o detener recorrido orbital 360° en 3D',
    mode3d: '3D TERRENO',
    mode2d: '2D PLANO',
    tiltTitle: 'Alternar inclinación y perspectiva 3D del terreno'
  },
  hud: {
    stationName: 'CENTRO DE MANDO // RED TELEMÉTRICA',
    stationSub: 'BANDA ANCHA 100 Hz • TIEMPO REAL',
    muteTitle: 'Silenciar alertas acústicas',
    unmuteTitle: 'Activar sonido de alerta sísmica',
    collapse: 'Minimizar HUD',
    expand: 'Expandir HUD',
    signalStream: 'FLUJO TELEMÉTRICO DE ESTACIÓN SÍSMICA',
    telemCoords: 'COORDENADAS',
    telemPitch: 'INCLINACIÓN 3D',
    telemAmplitude: 'AMPLITUD PGA',
    loadingSync: 'Sincronizando catálogo y relieve 3D...'
  },
  legend: {
    title: 'MAGNITUD (Mw)',
    minor: '< 3.5 Menor',
    moderate: '3.5 - 4.4 Moderado',
    strong: '4.5 - 5.9 Fuerte',
    major: '≥ 6.0 Mayor',
    faults: 'Fallas Tectónicas'
  },
  popup: {
    depth: 'prof.',
    localTime: 'LOCAL (UTC-6)',
    utcTime: 'OFICIAL UTC',
    reportBtn: '¿Lo sentiste? Reportar'
  },
  timeline: {
    play: 'Reproducir cronología sísmica',
    pause: 'Pausar animación',
    now: 'Ahora',
    reset: 'Restablecer'
  },
  detail: {
    depth: 'Profundidad',
    status: 'Estado',
    coords: 'Coordenadas',
    tsunami: 'Tsunami',
    tsunamiAlert: 'ALERTA',
    tsunamiNone: 'Sin alerta',
    citizenTitle: '¿Lo sentiste? (Sismología Ciudadana)',
    citizenDesc: 'Registra la intensidad percibida en tu ubicación:',
    notFelt: 'No sentido',
    weak: 'Leve',
    moderate: 'Moderado',
    strong: 'Fuerte',
    avgIntensity: 'Intensidad promedio reportada:',
    sendingReport: 'Enviando reporte comunitario...',
    retry: 'Reintentar'
  },
  filters: {
    title: 'FILTROS SÍSMICOS',
    minMag: 'Magnitud Mínima',
    timePeriod: 'Periodo Temporal',
    hours24: '24 Horas',
    days7: '7 Días',
    days30: '30 Días',
    focalDepth: 'Profundidad Focal',
    all: 'Todas',
    shallow: '< 30 km (Superficial)',
    intermediate: '< 70 km (Intermedia)',
    resetBtn: 'Restablecer',
    applyBtn: 'Aplicar Filtros'
  },
  landing: {
    company: 'FOZNA SOLUTIONS',
    product: 'SISMOS CENTROAMÉRICA',
    navCta: 'Entrar a la Consola',
    exploreCta: 'Explorar Consola en Vivo',
    docsCta: 'Ver Documentación Técnica',
    scrollHint: 'Desplaza para navegar el diorama 3D',
    skipLink: 'Saltar animación e ir directamente al Mapa →',
    scenes: [
      {
        badge: 'MONITORIZACIÓN CONTINUA',
        title: 'Centroamérica en Movimiento',
        subtitle: 'Una de las regiones sísmicamente más dinámicas del planeta',
        desc: 'La convergencia entre las placas de Cocos, Caribe y Norteamérica genera cientos de eventos cada mes. Nuestra plataforma captura, procesa y proyecta cada movimiento en tiempo real.',
        metricVal: '3 Placas',
        metricLbl: 'Interacción Tectónica Principal'
      },
      {
        badge: 'RELIEVE Y TELEMETRÍA 3D',
        title: 'Fosa Mesoamericana',
        subtitle: 'Subducción oceánica a más de 6,000 metros de profundidad',
        desc: 'Visualiza la trinchera marina en 3D con relieve batimétrico real. Analiza cómo la placa oceánica se desliza bajo el istmo generando sismos interplaca y vulcanismo activo.',
        metricVal: '6,669 m',
        metricLbl: 'Profundidad Máxima de la Fosa'
      },
      {
        badge: 'ESTACIONES SISMOLÓGICAS',
        title: 'Red Sísmica en Tiempo Real',
        subtitle: 'Ingesta continua del catálogo USGS y difusión por WebSocket',
        desc: 'El backend consulta el catálogo FDSN de USGS cada 60 segundos, persiste los eventos en PostGIS y los difunde al instante a todos los navegadores conectados mediante WebSocket (STOMP), con alerta visual y acústica.',
        metricVal: '60 s',
        metricLbl: 'Ciclo de Ingesta'
      },
      {
        badge: 'ARQUITECTURA SERVERLESS',
        title: 'Nube Distribuida de Alta Resiliencia',
        subtitle: 'Diseñado sobre Google Cloud Platform con Cloud Run',
        desc: 'Escalado automático en Cloud Run: desde la calma tectónica hasta enjambres sísmicos, el backend Java 21 + Spring Boot se ajusta a la demanda y se conecta a Cloud SQL por red privada (Direct VPC Egress), sin claves en el pipeline.',
        metricVal: '0 → N',
        metricLbl: 'Instancias bajo Demanda'
      },
      {
        badge: 'CIENCIA PARTICIPATIVA',
        title: 'Sismología Ciudadana',
        subtitle: 'El pulso de la población frente a cada evento telúrico',
        desc: 'Módulo interactivo "¿Lo sentiste?". Los ciudadanos reportan intensidades en segundos, construyendo mapas comunitarios de percepción georreferenciados.',
        metricVal: '100% Abierto',
        metricLbl: 'Reporte Colaborativo'
      }
    ]
  }
};

const EN_TRANSLATIONS: Translations = {
  header: {
    title: 'CENTRAL AMERICA EARTHQUAKES',
    subtitle: 'REAL-TIME SEISMIC MONITOR',
    events: 'EVENTS',
    maxMag: 'MAX MAG',
    home: 'Home',
    heatmap: 'Heatmap',
    filters: 'Advanced Filters'
  },
  camera: {
    title: '3D CENTER',
    all: '🌐 All',
    allTitle: 'Global view of Central America',
    trench: '🌋 Trench 3D',
    trenchTitle: '3D perspective with terrain relief of Middle America Trench',
    north: '🇬🇹 North',
    northTitle: 'Focus on Guatemala and El Salvador relief',
    south: '🇨🇷 South',
    southTitle: 'Focus on Costa Rica and Panama relief',
    orbitOn: 'ORBIT ON',
    orbitOff: 'ORBIT',
    orbitTitle: 'Start or stop 360° 3D orbital tour',
    mode3d: '3D TERRAIN',
    mode2d: '2D FLAT',
    tiltTitle: 'Toggle 3D terrain tilt and perspective'
  },
  hud: {
    stationName: 'COMMAND CENTER // TELEMETRY NETWORK',
    stationSub: 'BROADBAND 100 Hz • REAL-TIME',
    muteTitle: 'Mute acoustic alerts',
    unmuteTitle: 'Enable seismic sound alerts',
    collapse: 'Collapse HUD',
    expand: 'Expand HUD',
    signalStream: 'SEISMIC STATION TELEMETRY STREAM',
    telemCoords: 'COORDINATES',
    telemPitch: '3D TILT',
    telemAmplitude: 'PGA AMPLITUDE',
    loadingSync: 'Syncing catalog and 3D relief...'
  },
  legend: {
    title: 'MAGNITUDE (Mw)',
    minor: '< 3.5 Minor',
    moderate: '3.5 - 4.4 Moderate',
    strong: '4.5 - 5.9 Strong',
    major: '≥ 6.0 Major',
    faults: 'Tectonic Faults'
  },
  popup: {
    depth: 'depth',
    localTime: 'LOCAL (UTC-6)',
    utcTime: 'OFFICIAL UTC',
    reportBtn: 'Did you feel it? Report'
  },
  timeline: {
    play: 'Play seismic chronology',
    pause: 'Pause animation',
    now: 'Now',
    reset: 'Reset'
  },
  detail: {
    depth: 'Depth',
    status: 'Status',
    coords: 'Coordinates',
    tsunami: 'Tsunami',
    tsunamiAlert: 'ALERT',
    tsunamiNone: 'No alert',
    citizenTitle: 'Did you feel it? (Citizen Seismology)',
    citizenDesc: 'Record the perceived intensity at your location:',
    notFelt: 'Not felt',
    weak: 'Weak',
    moderate: 'Moderate',
    strong: 'Strong',
    avgIntensity: 'Average reported intensity:',
    sendingReport: 'Sending community report...',
    retry: 'Retry'
  },
  filters: {
    title: 'SEISMIC FILTERS',
    minMag: 'Minimum Magnitude',
    timePeriod: 'Time Period',
    hours24: '24 Hours',
    days7: '7 Days',
    days30: '30 Days',
    focalDepth: 'Focal Depth',
    all: 'All',
    shallow: '< 30 km (Shallow)',
    intermediate: '< 70 km (Intermediate)',
    resetBtn: 'Reset',
    applyBtn: 'Apply Filters'
  },
  landing: {
    company: 'FOZNA SOLUTIONS',
    product: 'CENTRAL AMERICA EARTHQUAKES',
    navCta: 'Enter Console',
    exploreCta: 'Explore Live Console',
    docsCta: 'Technical Documentation',
    scrollHint: 'Scroll to explore 3D diorama',
    skipLink: 'Skip animation and go directly to Map →',
    scenes: [
      {
        badge: 'CONTINUOUS MONITORING',
        title: 'Central America in Motion',
        subtitle: 'One of the most seismically dynamic regions on Earth',
        desc: 'The tectonic convergence among Cocos, Caribbean, and North American plates triggers hundreds of events each month. Our platform captures, processes, and displays every tremor in real time.',
        metricVal: '3 Plates',
        metricLbl: 'Primary Tectonic Interaction'
      },
      {
        badge: '3D TERRAIN & TELEMETRY',
        title: 'Middle America Trench',
        subtitle: 'Oceanic subduction exceeding 6,000 meters in depth',
        desc: 'Explore the oceanic trench in 3D with authentic bathymetric terrain. Analyze how the ocean slab subducts beneath the isthmus, fueling megathrust earthquakes and active volcanism.',
        metricVal: '6,669 m',
        metricLbl: 'Maximum Trench Depth'
      },
      {
        badge: 'SEISMIC OBSERVATORIES',
        title: 'Real-Time Seismic Network',
        subtitle: 'Continuous USGS catalog ingestion with WebSocket broadcast',
        desc: 'The backend polls the USGS FDSN catalog every 60 seconds, stores events in PostGIS and instantly pushes them to every connected browser over WebSocket (STOMP), with visual and acoustic alerts.',
        metricVal: '60 s',
        metricLbl: 'Ingestion Cycle'
      },
      {
        badge: 'SERVERLESS ARCHITECTURE',
        title: 'Resilient Distributed Cloud',
        subtitle: 'Architected on Google Cloud Platform with Cloud Run',
        desc: 'Cloud Run autoscaling: from seismic quiescence to earthquake swarms, the Java 21 + Spring Boot backend scales with demand and reaches Cloud SQL over a private network (Direct VPC Egress), with a keyless pipeline.',
        metricVal: '0 → N',
        metricLbl: 'On-Demand Instances'
      },
      {
        badge: 'COMMUNITY SCIENCE',
        title: 'Citizen Seismology',
        subtitle: 'Community sensing in response to ground shaking',
        desc: '"Did you feel it?" interactive module. Residents submit intensity reports in seconds, synthesizing real-time crowdsourced shaking maps.',
        metricVal: '100% Open',
        metricLbl: 'Collaborative Reporting'
      }
    ]
  }
};

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly storageKey = 'sismos_lang_pref';

  readonly currentLang = signal<Language>(this.getInitialLanguage());

  readonly tr = computed<Translations>(() => {
    return this.currentLang() === 'en' ? EN_TRANSLATIONS : ES_TRANSLATIONS;
  });

  toggleLanguage(): void {
    const nextLang: Language = this.currentLang() === 'es' ? 'en' : 'es';
    this.setLanguage(nextLang);
  }

  setLanguage(lang: Language): void {
    this.currentLang.set(lang);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, lang);
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
    }
  }

  private getInitialLanguage(): Language {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(this.storageKey);
        if (saved === 'es' || saved === 'en') {
          return saved;
        }
      } catch (e) {
        // Fallback
      }
    }
    return 'es';
  }
}
