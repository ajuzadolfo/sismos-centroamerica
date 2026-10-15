import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ErrorTrackingService } from './error-tracking.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  private readonly errorTracking = inject(ErrorTrackingService);

  handleError(error: unknown): void {
    try {
      this.errorTracking.captureError(error, 'Angular Unhandled Exception');
    } catch {
      // Evitar que el manejador global genere una excepción no capturada
    }
  }
}
