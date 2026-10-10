import { Component, HostListener, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface StoryScene {
  id: number;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  metricLabel: string;
  metricValue: string;
  accentColor: string;
  imageUrl: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="landing-page">
      <!-- Barra Superior de Navegación Fija -->
      <header class="landing-nav glass-nav">
        <div class="brand">
          <div class="pulse-beacon">
            <span class="core"></span>
            <span class="aura"></span>
          </div>
          <div class="brand-text">
            <span class="company">FOZNA SOLUTIONS</span>
            <span class="product">MONITOR SÍSMICO CENTROAMÉRICA</span>
          </div>
        </div>

        <nav class="nav-actions">
          <a routerLink="/monitor" class="btn-primary-glow">
            <span>Acceder al Monitor en Vivo</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </nav>
      </header>

      <!-- Escenario Cinemático Fijo (Dioramas Fotorrealistas con Parallax 3D) -->
      <div class="cinema-stage">
        <div class="backdrop-gradient"></div>

        <!-- Capas de Diorama Fotorrealistas (Transición continua por scroll) -->
        <div class="diorama-layers">
          @for (scene of scenes; track scene.id; let idx = $index) {
            <div 
              class="diorama-layer" 
              [class.active]="activeSceneIndex() === idx"
              [style.transform]="layerTransform(idx)">
              <img 
                [src]="scene.imageUrl" 
                [alt]="scene.title" 
                class="diorama-image" 
                loading="eager" />
              <div class="diorama-vignette"></div>
            </div>
          }
        </div>

        <!-- Cuadrícula Tectónica Holográfica y Efecto de Lente -->
        <div class="tectonic-grid" [style.transform]="gridTransform()"></div>
        <div class="vignette-overlay"></div>
        <div class="scanline-overlay"></div>
      </div>

      <!-- HUD Lateral: Indicador Interactivo de Escenas -->
      <aside class="scene-hud">
        <div class="hud-track">
          <div class="hud-fill" [style.height.%]="scrollProgress() * 100"></div>
          @for (scene of scenes; track scene.id; let idx = $index) {
            <button
              class="hud-dot"
              [class.active]="activeSceneIndex() === idx"
              (click)="scrollToScene(idx)"
              [title]="scene.title">
              <span class="dot-number">0{{ idx + 1 }}</span>
              <span class="dot-label">{{ scene.badge }}</span>
            </button>
          }
        </div>
      </aside>

      <!-- Pista de Desplazamiento Vertical (Scroll Track) -->
      <div class="scroll-track">
        @for (scene of scenes; track scene.id; let idx = $index) {
          <section class="scene-section" [id]="'scene-' + idx">
            <div class="scene-card glass-card" [class.visible]="activeSceneIndex() === idx">
              <div class="badge-pill" [style.color]="scene.accentColor" [style.borderColor]="scene.accentColor">
                <span class="badge-dot" [style.background]="scene.accentColor"></span>
                {{ scene.badge }}
              </div>

              <h2 class="scene-title">{{ scene.title }}</h2>
              <p class="scene-subtitle">{{ scene.subtitle }}</p>
              <p class="scene-desc">{{ scene.description }}</p>

              <div class="scene-metric">
                <span class="m-val" [style.color]="scene.accentColor">{{ scene.metricValue }}</span>
                <span class="m-lbl">{{ scene.metricLabel }}</span>
              </div>

              @if (idx === 4) {
                <div class="cta-group">
                  <a routerLink="/monitor" class="btn-cta-main">
                    <span>Abrir Monitor en Vivo</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </a>
                  <a href="https://github.com/ajuzadolfo/sismos-centroamerica" target="_blank" rel="noopener" class="btn-cta-secondary">
                    <span>Código en GitHub</span>
                  </a>
                </div>
              }
            </div>
          </section>
        }
      </div>

      <!-- Barra Inferior de Estado y Salto Rápido -->
      <footer class="landing-footer glass-footer">
        <div class="scroll-hint" [class.fade-out]="scrollProgress() > 0.85">
          <span class="mouse-icon">
            <span class="wheel"></span>
          </span>
          <span class="hint-text">Desplaza para navegar el diorama 3D</span>
        </div>

        <div class="direct-link">
          <a routerLink="/monitor" class="skip-btn">
            Saltar animación e ir directamente al Mapa &rarr;
          </a>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
      background: #03050a;
      color: #f1f5f9;
      font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
      overflow-x: hidden;
      overflow-y: visible;
    }

    .landing-page {
      position: relative;
      width: 100%;
      overflow: visible;
    }

    /* Navegación Superior Fija */
    .landing-nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 72px;
      padding: 0 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
      background: rgba(3, 5, 10, 0.75);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .pulse-beacon {
      position: relative;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pulse-beacon .core {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00e5ff;
      box-shadow: 0 0 12px #00e5ff;
    }

    .pulse-beacon .aura {
      position: absolute;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 1.5px solid rgba(0, 229, 255, 0.4);
      animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
    }

    @keyframes pulse-ring {
      0% { transform: scale(0.6); opacity: 0.9; }
      100% { transform: scale(1.8); opacity: 0; }
    }

    .brand-text .company {
      display: block;
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #ffffff;
    }

    .brand-text .product {
      display: block;
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      color: #00e5ff;
    }

    .btn-primary-glow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 20px;
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(0, 150, 255, 0.2));
      border: 1px solid #00e5ff;
      color: #ffffff;
      font-size: 0.85rem;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.3s ease;
      box-shadow: 0 0 16px rgba(0, 229, 255, 0.2);
    }

    .btn-primary-glow:hover {
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.35), rgba(0, 150, 255, 0.35));
      box-shadow: 0 0 24px rgba(0, 229, 255, 0.45);
      transform: translateY(-1px);
    }

    /* Escenario Fijo de Cine */
    .cinema-stage {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 1;
      pointer-events: none;
      overflow: hidden;
      background: #03050a;
    }

    .backdrop-gradient {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 60% 40%, rgba(0, 229, 255, 0.05) 0%, transparent 60%);
      z-index: 2;
    }

    /* Capas de Diorama con Transición Fotorrealista */
    .diorama-layers {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }

    .diorama-layer {
      position: absolute;
      inset: -5%;
      width: 110%;
      height: 110%;
      opacity: 0;
      transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.1, 0.9, 0.2, 1);
      will-change: opacity, transform;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .diorama-layer.active {
      opacity: 1;
    }

    .diorama-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      filter: brightness(0.85) contrast(1.08) saturate(1.05);
    }

    .diorama-vignette {
      position: absolute;
      inset: 0;
      background: 
        radial-gradient(circle at 60% 50%, transparent 30%, rgba(3, 5, 10, 0.8) 85%),
        linear-gradient(to right, rgba(3, 5, 10, 0.95) 0%, rgba(3, 5, 10, 0.4) 40%, rgba(3, 5, 10, 0.85) 100%),
        linear-gradient(to top, rgba(3, 5, 10, 0.95) 0%, transparent 25%);
      pointer-events: none;
    }

    .tectonic-grid {
      position: absolute;
      inset: -20%;
      background-image: 
        linear-gradient(rgba(0, 229, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 229, 255, 0.03) 1px, transparent 1px);
      background-size: 80px 80px;
      transform-origin: center center;
      z-index: 3;
      pointer-events: none;
      transition: transform 0.2s cubic-bezier(0.1, 0.9, 0.2, 1);
    }

    .vignette-overlay {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, transparent 40%, rgba(3, 5, 10, 0.8) 100%);
      z-index: 4;
    }

    .scanline-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%);
      background-size: 100% 4px;
      opacity: 0.15;
      z-index: 5;
      pointer-events: none;
    }

    /* Lateral Scene HUD */
    .scene-hud {
      position: fixed;
      left: 36px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 50;
    }

    .hud-track {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-left: 14px;
      border-left: 2px solid rgba(255, 255, 255, 0.12);
    }

    .hud-fill {
      position: absolute;
      left: -2px;
      top: 0;
      width: 2px;
      background: #00e5ff;
      box-shadow: 0 0 10px #00e5ff;
      transition: height 0.1s linear;
    }

    .hud-dot {
      background: none;
      border: none;
      padding: 0;
      text-align: left;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
      opacity: 0.35;
      transition: all 0.3s ease;
    }

    .hud-dot:hover, .hud-dot.active {
      opacity: 1;
      transform: translateX(4px);
    }

    .dot-number {
      font-size: 0.7rem;
      font-weight: 800;
      color: #00e5ff;
      font-family: monospace;
    }

    .dot-label {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #ffffff;
      text-transform: uppercase;
    }

    /* Pista de Scroll */
    .scroll-track {
      position: relative;
      z-index: 10;
    }

    .scene-section {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 8vw;
      box-sizing: border-box;
    }

    .scene-card {
      max-width: 540px;
      padding: 40px 44px;
      border-radius: 24px;
      background: rgba(6, 11, 20, 0.82);
      backdrop-filter: blur(28px);
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 28px 70px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.15);
      opacity: 0;
      transform: translateY(30px);
      transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .scene-card.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 14px;
      border-radius: 999px;
      border: 1px solid;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 18px;
    }

    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .scene-title {
      font-size: 2.3rem;
      font-weight: 800;
      line-height: 1.15;
      margin: 0 0 10px 0;
      color: #ffffff;
      letter-spacing: -0.02em;
    }

    .scene-subtitle {
      font-size: 1.1rem;
      font-weight: 600;
      color: #94a3b8;
      margin: 0 0 16px 0;
      line-height: 1.4;
    }

    .scene-desc {
      font-size: 0.95rem;
      line-height: 1.6;
      color: #cbd5e1;
      margin: 0 0 24px 0;
    }

    .scene-metric {
      padding: 16px 22px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.09);
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .scene-metric .m-val {
      font-family: monospace;
      font-size: 1.6rem;
      font-weight: 800;
    }

    .scene-metric .m-lbl {
      font-size: 0.7rem;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .cta-group {
      margin-top: 26px;
      display: flex;
      gap: 14px;
    }

    .btn-cta-main {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 24px;
      border-radius: 12px;
      background: #00e5ff;
      color: #03050a;
      font-weight: 800;
      font-size: 0.95rem;
      text-decoration: none;
      transition: all 0.25s ease;
      box-shadow: 0 0 24px rgba(0, 229, 255, 0.45);
    }

    .btn-cta-main:hover {
      background: #ffffff;
      transform: translateY(-2px);
      box-shadow: 0 0 32px rgba(0, 229, 255, 0.65);
    }

    .btn-cta-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 14px 20px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      font-weight: 700;
      font-size: 0.9rem;
      text-decoration: none;
      transition: all 0.25s ease;
    }

    .btn-cta-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    /* Barra Inferior */
    .landing-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60px;
      padding: 0 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 50;
      background: linear-gradient(to top, rgba(3, 5, 10, 0.85), transparent);
    }

    .scroll-hint {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #94a3b8;
      font-size: 0.75rem;
      font-weight: 600;
      transition: opacity 0.3s ease;
    }

    .scroll-hint.fade-out {
      opacity: 0;
    }

    .mouse-icon {
      width: 14px;
      height: 22px;
      border-radius: 10px;
      border: 1.5px solid #94a3b8;
      position: relative;
    }

    .mouse-icon .wheel {
      position: absolute;
      top: 4px;
      left: 50%;
      transform: translateX(-50%);
      width: 2px;
      height: 5px;
      background: #00e5ff;
      border-radius: 1px;
      animation: wheel-scroll 1.5s infinite;
    }

    @keyframes wheel-scroll {
      0% { top: 3px; opacity: 1; }
      100% { top: 12px; opacity: 0; }
    }

    .skip-btn {
      color: #94a3b8;
      font-size: 0.8rem;
      font-weight: 600;
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .skip-btn:hover {
      color: #00e5ff;
    }

    /* Responsive */
    @media (max-width: 900px) {
      .scene-section {
        justify-content: center;
        padding: 0 20px;
      }
      .scene-hud {
        display: none;
      }
      .scene-title {
        font-size: 1.7rem;
      }
      .scene-card {
        padding: 28px 24px;
      }
    }

    @media (max-width: 640px) {
      .landing-nav {
        height: 58px;
        padding: 0 16px;
      }

      .brand-text .product {
        display: none;
      }

      .btn-primary-glow {
        padding: 8px 14px;
        font-size: 0.78rem;
        gap: 6px;
      }

      .scene-section {
        padding: 0 12px;
      }

      .scene-card {
        padding: 22px 18px;
        border-radius: 18px;
      }

      .scene-title {
        font-size: 1.45rem;
      }

      .scene-subtitle {
        font-size: 0.9rem;
        margin-bottom: 12px;
      }

      .scene-desc {
        font-size: 0.82rem;
        margin-bottom: 16px;
        line-height: 1.5;
      }

      .scene-metric {
        padding: 10px 14px;
      }

      .scene-metric .m-val {
        font-size: 1.3rem;
      }

      .cta-group {
        flex-direction: column;
        gap: 8px;
        margin-top: 18px;
      }

      .btn-cta-main, .btn-cta-secondary {
        padding: 11px 16px;
        font-size: 0.85rem;
      }

      .landing-footer {
        height: 50px;
        padding: 0 16px;
        justify-content: center;
      }

      .scroll-hint {
        display: none;
      }

      .direct-link {
        width: 100%;
        text-align: center;
      }
    }
  `]
})
export class LandingComponent {
  scrollProgress = signal<number>(0);

  scenes: StoryScene[] = [
    {
      id: 1,
      badge: 'MONITORIZACIÓN CONTINUA',
      title: 'Centroamérica en Movimiento',
      subtitle: 'Una de las regiones sísmicamente más dinámicas del planeta',
      description: 'Supervisión constante de la interacción entre la placa de Cocos y la placa del Caribe a lo largo del istmo centroamericano.',
      metricValue: '6 Países',
      metricLabel: 'Supervisión regional unificada',
      accentColor: '#00e5ff',
      imageUrl: '/dioramas/scene-1.jpg'
    },
    {
      id: 2,
      badge: 'DETECCIÓN PROFUNDA',
      title: 'Falla Tectónica y Subducción',
      subtitle: 'Cuando la tierra cruje, cada segundo cuenta',
      description: 'Ingesta automatizada de eventos telúricos desde los feeds geofísicos del USGS y redes FDSN en menos de 60 segundos.',
      metricValue: '< 60s',
      metricLabel: 'Tiempo de detección e ingesta',
      accentColor: '#ff9100',
      imageUrl: '/dioramas/scene-2.jpg'
    },
    {
      id: 3,
      badge: 'PRECISIÓN POSTGIS',
      title: 'Observatorio en Superficie',
      subtitle: 'Matemática espacial en milisegundos',
      description: 'Cálculos de proximidad geodésica esferoidal, hipocentro y magnitud acelerados mediante PostgreSQL 16 y PostGIS 3.4.',
      metricValue: '< 50ms',
      metricLabel: 'Latencia p95 de consulta espacial',
      accentColor: '#00e676',
      imageUrl: '/dioramas/scene-3.jpg'
    },
    {
      id: 4,
      badge: 'ARQUITECTURA SERVERLESS',
      title: 'La Nube Distribuida',
      subtitle: 'Streaming sin fricción a escala regional',
      description: 'Arquitectura en Google Cloud Run con Direct VPC Egress, WebSockets STOMP bidireccionales y coordinación distribuida ShedLock.',
      metricValue: '99.9%',
      metricLabel: 'Disponibilidad multi-zona',
      accentColor: '#38bdf8',
      imageUrl: '/dioramas/scene-4.jpg'
    },
    {
      id: 5,
      badge: 'SISMOLOGÍA CIUDADANA',
      title: 'Tú también eres el Sensor',
      subtitle: 'Reporta en 3 clics y mapea la intensidad',
      description: 'Validación geométrica de reportes comunitarios "¿Lo sentiste?" con agregación en tiempo real para proteger a la población.',
      metricValue: '100% En Vivo',
      metricLabel: 'WebSockets y mapa vectorial interactivo',
      accentColor: '#ff1744',
      imageUrl: '/dioramas/scene-5.jpg'
    }
  ];

  activeSceneIndex = computed(() => {
    const p = this.scrollProgress();
    const count = this.scenes.length;
    const index = Math.min(Math.floor(p * count), count - 1);
    return Math.max(0, index);
  });

  activeScene = computed(() => this.scenes[this.activeSceneIndex()]);

  layerTransform(idx: number): string {
    const p = this.scrollProgress();
    // Parallax suave dentro de cada escena activa
    const sceneProgress = Math.max(0, Math.min(1, (p * this.scenes.length) - idx));
    const scale = 1 + (sceneProgress * 0.07);
    const translateY = (sceneProgress - 0.5) * -25;
    return `scale(${scale}) translateY(${translateY}px)`;
  }

  gridTransform(): string {
    const p = this.scrollProgress();
    const scale = 1 + p * 0.3;
    const rotate = p * 12;
    return `scale(${scale}) rotate(${rotate}deg)`;
  }

  @HostListener('window:scroll')
  onScroll() {
    const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const maxScroll = Math.max(1, (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight);
    const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
    this.scrollProgress.set(progress);
  }

  scrollToScene(index: number) {
    const maxScroll = Math.max(1, (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight);
    const targetY = maxScroll * (index / (this.scenes.length - 1));
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }
}
