import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
// FIGYELD AZ IMPORTOT: Itt húzzuk be a SOCIAL_AUTH_CONFIG-ot!
import { SOCIAL_AUTH_CONFIG, SocialAuthServiceConfig, GoogleLoginProvider } from '@abacritt/angularx-social-login';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    {
      provide: SOCIAL_AUTH_CONFIG, // <-- NINCS IDÉZŐJEL! Ezt a konstanst kereste a rendszer!
      useValue: {
        autoLogin: false,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider('567887725034-56lg9t1s9rplp8q572v48697qmh76pfg.apps.googleusercontent.com')
          }
        ],
        onError: (err) => {
          console.error('Google Auth Hiba:', err);
        }
      } as SocialAuthServiceConfig,
    }
  ]
};