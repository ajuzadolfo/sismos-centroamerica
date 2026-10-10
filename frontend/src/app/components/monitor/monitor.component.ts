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
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      height: 100dvh;
      overflow: hidden;
      background: var(--bg-space);
      z-index: 10;
    }

    .monitor-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      min-height: 26px;
      padding-top: 4px;
      padding-bottom: max(env(safe-area-inset-bottom, 0px), 4px);
      padding-left: 12px;
      padding-right: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(3, 7, 18, 0.94);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      z-index: 70;
      user-select: none;
      pointer-events: auto;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.5);
    }

    .footer-text {
      font-size: 0.72rem;
      font-weight: 500;
      letter-spacing: 0.06em;
      color: #94a3b8;
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

