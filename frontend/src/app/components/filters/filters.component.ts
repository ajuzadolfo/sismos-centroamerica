import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EarthquakeService } from '../../services/earthquake.service';
import { EarthquakeFilter } from '../../models/earthquake.model';

@Component({
  selector: 'app-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="drawer-overlay" (click)="close.emit()">
      <div class="drawer-panel glass-panel" (click)="$event.stopPropagation()">
        <div class="drawer-header">
          <h2>FILTROS SÍSMICOS</h2>
          <button class="close-btn" (click)="close.emit()">&times;</button>
        </div>

        <div class="drawer-content">
          <!-- Magnitud Mínima -->
          <div class="filter-group">
            <div class="filter-label-row">
              <label>Magnitud Mínima</label>
              <span class="value-badge">M {{ minMag() | number:'1.1-1' }}+</span>
            </div>
            <input
              type="range"
              min="0"
              max="7.0"
              step="0.1"
              [(ngModel)]="minMag"
              class="range-slider"
            />
            <div class="scale-labels">
              <span>M 0</span>
              <span>M 3.5</span>
              <span>M 5.0</span>
              <span>M 7+</span>
            </div>
          </div>

          <!-- Rango Temporal -->
          <div class="filter-group">
            <label>Periodo Temporal</label>
            <div class="pill-group">
              <button [class.active]="daysBack() === 1" (click)="daysBack.set(1)">24 Horas</button>
              <button [class.active]="daysBack() === 7" (click)="daysBack.set(7)">7 Días</button>
              <button [class.active]="daysBack() === 30" (click)="daysBack.set(30)">30 Días</button>
            </div>
          </div>

          <!-- Profundidad Focal -->
          <div class="filter-group">
            <label>Profundidad Focal</label>
            <div class="pill-group">
              <button [class.active]="maxDepth() === 0" (click)="maxDepth.set(0)">Todas</button>
              <button [class.active]="maxDepth() === 30" (click)="maxDepth.set(30)">&lt; 30 km (Superficial)</button>
              <button [class.active]="maxDepth() === 70" (click)="maxDepth.set(70)">&lt; 70 km (Intermedia)</button>
            </div>
          </div>
        </div>

        <div class="drawer-footer">
          <button class="btn-secondary" (click)="resetFilters()">Restablecer</button>
          <button class="btn-primary" (click)="applyFilters()">Aplicar Filtros</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .drawer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 200;
      display: flex;
      justify-content: flex-end;
    }

    .drawer-panel {
      width: 360px;
      max-width: 100vw;
      height: 100%;
      border-radius: 0;
      border-left: 1px solid var(--border-subtle);
      border-top: none;
      border-bottom: none;
      border-right: none;
      display: flex;
      flex-direction: column;
      animation: slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slide-in {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    .drawer-header {
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle);
    }

    .drawer-header h2 {
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #ffffff;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 1.8rem;
      cursor: pointer;
      line-height: 1;
    }
    .close-btn:hover { color: #ffffff; }

    .drawer-content {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .filter-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .filter-group label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .value-badge {
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 0.85rem;
      color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
    }

    .range-slider {
      width: 100%;
      height: 6px;
      -webkit-appearance: none;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      outline: none;
    }

    .range-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #00f0ff;
      box-shadow: 0 0 10px #00f0ff;
      cursor: pointer;
    }

    .scale-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }

    .pill-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pill-group button {
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
    }

    .pill-group button:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }

    .pill-group button.active {
      background: rgba(0, 240, 255, 0.15);
      border-color: var(--accent-cyan);
      color: var(--accent-cyan);
      font-weight: 600;
    }

    .drawer-footer {
      padding: 20px 24px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .drawer-footer button {
      flex: 1;
    }
  `]
})
export class FiltersComponent {
  earthquakeService = inject(EarthquakeService);

  @Output() close = new EventEmitter<void>();

  minMag = signal<number>(this.earthquakeService.filters().minMagnitude);
  daysBack = signal<number>(this.earthquakeService.filters().daysBack);
  maxDepth = signal<number>(this.earthquakeService.filters().maxDepth ?? 0);

  applyFilters() {
    const filter: EarthquakeFilter = {
      minMagnitude: Number(this.minMag()),
      daysBack: this.daysBack(),
      maxDepth: this.maxDepth() > 0 ? this.maxDepth() : undefined
    };

    this.earthquakeService.loadFilteredEarthquakes(filter).subscribe();
    this.close.emit();
  }

  resetFilters() {
    this.minMag.set(0);
    this.daysBack.set(7);
    this.maxDepth.set(0);
    this.applyFilters();
  }
}
