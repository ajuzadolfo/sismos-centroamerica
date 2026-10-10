import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { MapComponent } from './components/map/map.component';
import { TimelineComponent } from './components/timeline/timeline.component';
import { DetailPanelComponent } from './components/detail-panel/detail-panel.component';
import { FiltersComponent } from './components/filters/filters.component';
import { WebSocketService } from './services/websocket.service';

@Component({
  selector: 'app-root',
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
    <main class="app-container">
      <app-header (toggleFilterDrawer)="isFilterOpen.set(!isFilterOpen())" />
      <app-map />
      <app-timeline />
      <app-detail-panel />

      @if (isFilterOpen()) {
        <app-filters (close)="isFilterOpen.set(false)" />
      }
    </main>
  `,
  styles: [`
    .app-container {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: var(--bg-space);
    }
  `]
})
export class AppComponent implements OnInit {
  private wsService = inject(WebSocketService);
  isFilterOpen = signal<boolean>(false);

  ngOnInit() {
    this.wsService.connect();
  }
}
