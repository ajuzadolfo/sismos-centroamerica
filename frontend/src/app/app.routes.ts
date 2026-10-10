import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { MonitorComponent } from './components/monitor/monitor.component';

export const routes: Routes = [
  { path: '', component: LandingComponent, title: 'Sismos Centroamérica | Fozna Solutions' },
  { path: 'monitor', component: MonitorComponent, title: 'Monitor Sísmico en Vivo | Fozna Solutions' },
  { path: '**', redirectTo: '' }
];
