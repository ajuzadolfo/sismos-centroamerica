import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `<router-outlet />`,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      min-height: 100vh;
      margin: 0;
      padding: 0;
      background: var(--bg-space);
    }
  `]
})
export class AppComponent {}

