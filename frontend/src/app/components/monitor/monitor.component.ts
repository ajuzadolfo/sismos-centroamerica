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

