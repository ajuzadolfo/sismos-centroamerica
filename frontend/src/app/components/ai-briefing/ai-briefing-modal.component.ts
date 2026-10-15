import { Component, EventEmitter, Input, Output, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EarthquakeService } from '../../services/earthquake.service';
import { TranslationService } from '../../services/translation.service';
import { SeismicIntelligenceReport } from '../../models/earthquake.model';

@Component({
  selector: 'app-ai-briefing-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="ai-modal glass-panel" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          @if (!loading() && report(); as rep) {
            @if (isLiveModel(rep.modelUsed)) {
              <div class="ai-badge live" title="Análisis en vivo generado por Gemini 3.8 Flash">
                <span class="pulse-dot"></span>
                <span class="badge-title">GEMINI 3.8 FLASH // EN VIVO</span>
              </div>
            } @else {
              <div class="ai-badge fallback" title="Inferencia Gemini offline. Operando con Motor de Reglas Geocientíficas de Respaldo">
                <span class="badge-icon">🛡️</span>
                <span class="badge-title">MODO RESPALDO (OFFLINE)</span>
              </div>
            }
          } @else {
            <div class="ai-badge live">
              <span class="sparkle-icon">✨</span>
              <span class="badge-title">FOZNA AI // GEMINI 3.8 FLASH</span>
            </div>
          }
          <button class="close-btn" (click)="close.emit()">&times;</button>
        </div>

        @if (loading()) {
          <div class="loading-state">
            <div class="ai-scanner"></div>
            <p class="loading-text">{{ transService.currentLang() === 'en' ? 'Generating geoscientific analysis with Gemini 3.8 Flash...' : 'Generando análisis geocientífico con Gemini 3.8 Flash...' }}</p>
          </div>
        }
        @if (error()) {
          <div class="error-state">
            <p>{{ error() }}</p>
            <button class="retry-btn" (click)="loadReport()">{{ transService.currentLang() === 'en' ? 'Retry' : 'Reintentar' }}</button>
          </div>
        }
        @if (!loading() && !error() && report(); as rep) {
          <div class="modal-content">
            <h3 class="event-title">{{ rep.title }}</h3>
            
            <div class="meta-tags">
              <span class="tag intensity">{{ rep.estimatedPeakIntensity }}</span>
              @if (isLiveModel(rep.modelUsed)) {
                <span class="tag model live" title="Modelo en Vivo">⚡ {{ rep.modelUsed }}</span>
              } @else {
                <span class="tag model fallback" title="Respaldo Geocientífico Offline">🛡️ Modo Respaldo (Offline)</span>
              }
            </div>

            @if (!isLiveModel(rep.modelUsed)) {
              <div class="offline-banner">
                <span class="offline-icon">🛡️</span>
                <div class="offline-text">
                  <strong>{{ transService.currentLang() === 'en' ? 'Offline Geoscientific Fallback' : 'Modo Respaldo Geocientífico Offline' }}</strong>
                  <span>{{ transService.currentLang() === 'en' ? 'Live Gemini 3.8 inference is unreachable or unconfigured. This briefing was generated deterministically by the regional tectonic engine.' : 'La inferencia con Gemini 3.8 no está disponible o no tiene clave configurada. Este informe fue generado por el motor de reglas tectónicas de respaldo.' }}</span>
                </div>
              </div>
            }

            <!-- Resumen Ejecutivo -->
            <div class="section-box">
              <h4 class="section-title">
                <span class="icon">📋</span>
                {{ transService.currentLang() === 'en' ? 'Executive Seismic Briefing' : 'Resumen Ejecutivo Sísmico' }}
              </h4>
              <p class="summary-text">{{ rep.executiveSummary }}</p>
            </div>

            <!-- Contexto Tectónico -->
            <div class="section-box">
              <h4 class="section-title">
                <span class="icon">🌋</span>
                {{ transService.currentLang() === 'en' ? 'Tectonic Setting & Geodynamics' : 'Contexto Tectónico y Geodinámica' }}
              </h4>
              <p class="body-text">{{ rep.tectonicContext }}</p>
            </div>

            <!-- Evaluación de Tsunami -->
            <div class="section-box tsunami-box" [class.danger]="rep.tsunamiRiskAssessment.includes('ALERTA') || rep.tsunamiRiskAssessment.includes('ALERT')">
              <h4 class="section-title">
                <span class="icon">🌊</span>
                {{ transService.currentLang() === 'en' ? 'Tsunami Threat Assessment' : 'Evaluación de Amenaza de Tsunami' }}
              </h4>
              <p class="body-text">{{ rep.tsunamiRiskAssessment }}</p>
            </div>

            <!-- Recomendaciones Civiles -->
            @if (rep.safetyRecommendations && rep.safetyRecommendations.length > 0) {
              <div class="section-box">
                <h4 class="section-title">
                  <span class="icon">🛡️</span>
                  {{ transService.currentLang() === 'en' ? 'Civil Protection Guidelines' : 'Recomendaciones de Protección Civil' }}
                </h4>
                <ul class="rec-list">
                  @for (rec of rep.safetyRecommendations; track $index) {
                    <li>{{ rec }}</li>
                  }
                </ul>
              </div>
            }

            <div class="disclaimer-note">
              {{ transService.currentLang() === 'en' 
                ? 'Automated geoscientific synthesis generated via Google Vertex AI. Confirm official advisories with national agencies.' 
                : 'Síntesis geocientífica automatizada generada mediante Google Vertex AI. Confirme directrices oficiales con autoridades nacionales.' }}
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(3, 7, 18, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 16px;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .ai-modal {
      width: 100%;
      max-width: 580px;
      max-height: 85vh;
      overflow-y: auto;
      background: rgba(11, 15, 25, 0.94);
      border: 1px solid rgba(0, 240, 255, 0.35);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 240, 255, 0.15);
      position: relative;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 12px;
    }

    .ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: 30px;
      padding: 4px 14px;
      transition: all 0.25s ease;
    }

    .ai-badge.live {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(139, 92, 246, 0.25));
      border: 1px solid rgba(0, 240, 255, 0.4);
    }

    .ai-badge.fallback {
      background: rgba(251, 191, 36, 0.12);
      border: 1px solid rgba(251, 191, 36, 0.45);
    }

    .ai-badge.fallback .badge-title {
      color: #fbbf24;
    }

    .badge-icon {
      font-size: 0.95rem;
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 6px #10b981;
      animation: status-pulse 1.8s infinite ease-in-out;
    }

    @keyframes status-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .sparkle-icon {
      font-size: 1rem;
    }

    .badge-title {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #00f0ff;
      font-family: var(--font-mono);
    }

    .close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 1.6rem;
      cursor: pointer;
      line-height: 1;
      transition: color 0.15s ease;
    }
    .close-btn:hover { color: #ffffff; }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      gap: 20px;
    }

    .ai-scanner {
      width: 48px;
      height: 48px;
      border: 3px solid rgba(0, 240, 255, 0.2);
      border-top-color: #00f0ff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-text {
      font-size: 0.85rem;
      color: #94a3b8;
      text-align: center;
      font-family: var(--font-mono);
    }

    .event-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 12px;
    }

    .meta-tags {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }

    .tag {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 6px;
      font-family: var(--font-mono);
    }
    .tag.intensity {
      background: rgba(255, 145, 0, 0.15);
      border: 1px solid rgba(255, 145, 0, 0.35);
      color: #ff9100;
    }
    .tag.model {
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.35);
      color: #a78bfa;
    }

    .tag.model.live {
      background: rgba(0, 240, 255, 0.12);
      border: 1px solid rgba(0, 240, 255, 0.35);
      color: #00f0ff;
    }

    .tag.model.fallback {
      background: rgba(251, 191, 36, 0.12);
      border: 1px solid rgba(251, 191, 36, 0.35);
      color: #fbbf24;
    }

    .offline-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: rgba(251, 191, 36, 0.08);
      border: 1px solid rgba(251, 191, 36, 0.3);
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 0.74rem;
      color: #fde68a;
    }

    .offline-icon {
      font-size: 1.1rem;
      line-height: 1;
      margin-top: 1px;
    }

    .offline-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .offline-text strong {
      color: #fbbf24;
      font-size: 0.78rem;
    }

    .section-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 14px;
    }

    .section-box.tsunami-box {
      border-left: 3px solid #00f0ff;
    }
    .section-box.tsunami-box.danger {
      border-left: 3px solid #ff1744;
      background: rgba(255, 23, 68, 0.05);
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #f1f5f9;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .summary-text, .body-text {
      font-size: 0.82rem;
      line-height: 1.55;
      color: #cbd5e1;
    }

    .rec-list {
      margin-left: 18px;
      font-size: 0.8rem;
      color: #cbd5e1;
      line-height: 1.5;
    }

    .rec-list li {
      margin-bottom: 6px;
    }

    .disclaimer-note {
      font-size: 0.65rem;
      color: #64748b;
      text-align: center;
      margin-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 12px;
      font-style: italic;
    }

    .error-state {
      text-align: center;
      padding: 40px 20px;
      color: #ff5252;
    }

    .retry-btn {
      margin-top: 12px;
      padding: 6px 16px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      color: #ffffff;
      cursor: pointer;
    }

    @media (max-width: 480px) {
      .modal-backdrop {
        padding: 8px;
      }
      .ai-modal {
        padding: 16px 14px;
        max-height: 92dvh;
        border-radius: 14px;
      }
    }
  `]
})
export class AiBriefingModalComponent implements OnInit {
  @Input({ required: true }) eventId!: string;
  @Output() close = new EventEmitter<void>();

  private earthquakeService = inject(EarthquakeService);
  transService = inject(TranslationService);

  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly report = signal<SeismicIntelligenceReport | null>(null);

  ngOnInit() {
    this.loadReport();
  }

  loadReport() {
    this.loading.set(true);
    this.error.set(null);
    this.earthquakeService.getIntelligenceReport(this.eventId).subscribe({
      next: (rep) => {
        this.report.set(rep);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          this.transService.currentLang() === 'en'
            ? 'Unable to load AI analysis. Please verify network connectivity.'
            : 'No fue posible cargar el informe de IA. Verifique la conexión de red.'
        );
        this.loading.set(false);
      }
    });
  }

  isLiveModel(modelUsed?: string): boolean {
    if (!modelUsed) return false;
    const lower = modelUsed.toLowerCase();
    return !lower.includes('fallback') && !lower.includes('rules-engine') && lower !== 'offline';
  }
}
