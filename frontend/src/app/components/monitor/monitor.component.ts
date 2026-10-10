import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { MapComponent } from '../map/map.component';
import { TimelineComponent } from '../timeline/timeline.component';
import { DetailPanelComponent } from '../detail-panel/detail-panel.component';
import { FiltersComponent } from '../filters/filters.component';
import { WebSocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    MapComponent,
    TimelineComponent,
    DetailPanelComponent,
    FiltersComponent
  ],
  template: `
    <div class="monitor-container">
      <app-header (toggleFilterDrawer)="isFilterOpen.set(!isFilterOpen())" />
      <app-map />
      <app-timeline />
      <app-detail-panel />

      @if (isFilterOpen()) {
        <app-filters (close)="isFilterOpen.set(false)" />
      }

      <footer class="monitor-footer">
        <span class="footer-text">Fozna Solutions 2026</span>
      </footer>
    </div>
  `,
  styles: [`
    .monitor-container {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: var(--bg-space);
      z-index: 10;
    }

    .monitor-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(3, 7, 18, 0.88);
      backdrop-filter: blur(10px);
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      z-index: 45;
      user-select: none;
      pointer-events: auto;
    }

    .footer-text {
      font-size: 0.68rem;
      font-weight: 500;
      letter-spacing: 0.06em;
      color: #64748b;
      font-family: var(--font-sans);
    }
  `]
})
export class MonitorComponent implements OnInit, OnDestroy {
  private wsService = inject(WebSocketService);
  isFilterOpen = signal<boolean>(false);

  ngOnInit() {
    this.wsService.connect();
  }

  ngOnDestroy() {
    this.wsService.disconnect();
  }
}

