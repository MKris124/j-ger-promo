import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { environment } from '../../../environments/environments';

declare const jsQR: any;

interface PrizePocket {
  id: number;
  qrCodeHash: string;
  status: 'AVAILABLE' | 'REDEEMED';
  wonAt: string | null;
  redeemedAt: string | null;
  userName: string | null;
  inventoryItem: { id: number; name: string; liquid: boolean } | null;
}

type ScanState = 'scanning' | 'loading' | 'preview' | 'success' | 'error';

@Component({
  selector: 'app-promoter',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  templateUrl: './promoter.component.html',
})
export class PromoterComponent implements OnInit, OnDestroy {
  private http        = inject(HttpClient);
  private authService = inject(AuthService);
  private zone        = inject(NgZone);
  private router      = inject(Router);

  private apiBase = `${environment.apiUrl}/api/promoter`;

  @ViewChild('videoEl',  { static: false }) videoEl!:  ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl', { static: false }) canvasEl!: ElementRef<HTMLCanvasElement>;

  state: ScanState = 'scanning';
  pocket: PrizePocket | null = null;
  errorMessage = '';
  redeeming    = false;

  private stream:          MediaStream | null = null;
  private animFrameId:     number | null      = null;
  private lastScannedHash  = '';

  ngOnInit(): void {
    this.loadJsQR().then(() => this.startCamera());
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  private loadJsQR(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof jsQR !== 'undefined') { resolve(); return; }
      const script  = document.createElement('script');
      script.src    = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  private async startCamera(): Promise<void> {
    try {
      // 1. Engedélykérés + device lista
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      tempStream.getTracks().forEach(t => t.stop());

      const devices      = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');

      let optimalDeviceId: string | null = null;

      if (videoDevices.length > 0) {
        const isApple = /iPhone|iPad|Macintosh/i.test(navigator.userAgent) &&
                        ('ontouchstart' in window || navigator.maxTouchPoints > 2);

        if (isApple) {
          optimalDeviceId = videoDevices.length > 1
            ? videoDevices[1].deviceId
            : videoDevices[0].deviceId;
        } else {
          const backCameras = videoDevices.filter(d =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear')
          );
          if (backCameras.length > 0) {
            const main = backCameras.find(d => d.label.includes('0')) ??
                         backCameras.find(d =>
                           !d.label.toLowerCase().includes('ultra') &&
                           !d.label.toLowerCase().includes('tele') &&
                           !d.label.toLowerCase().includes('wide')
                         ) ??
                         backCameras[0];
            optimalDeviceId = main.deviceId;
          }
        }
      }

      // 2. Stream indítása
      const constraints: MediaStreamConstraints = {
        video: optimalDeviceId
          ? {
              deviceId: { exact: optimalDeviceId },
              width:  { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720  },
            }
          : {
              facingMode: 'environment',
              width:  { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720  },
            }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // 3. Fókusz beállítása a track-en közvetlenül — constraints-ben
      //    az advanced/focusMode nem minden böngészőben működik,
      //    applyConstraints() megbízhatóbb
      const track = this.stream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities() as any;
        if (capabilities?.focusMode?.includes('continuous')) {
          await (track as any).applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
        }
      }

      // 4. Video elem bekötése és lejátszás
      const video       = this.videoEl.nativeElement;
      video.srcObject   = this.stream;
      video.playsInline = true; // iOS kötelező
      video.muted       = true;
      await video.play();

      // 5. Várunk amíg a kamera stabilan éles képet ad
      //    'loadeddata' event után még 800ms-t adunk a fókusznak
      await new Promise<void>(resolve => {
        if (video.readyState >= 2) { resolve(); return; }
        video.addEventListener('loadeddata', () => resolve(), { once: true });
      });

      // Fókuszidő: hagyunk időt az autofókusznak hogy éles képet adjon
      // mielőtt a scan loop elkezd képet elemezni
      await new Promise(r => setTimeout(r, 800));

      this.scanLoop();

    } catch (error) {
      console.error('Kamera hiba:', error);
      this.zone.run(() => {
        this.state        = 'error';
        this.errorMessage = 'Nem sikerült hozzáférni a kamerához. Ellenőrizd a jogosultságokat!';
      });
    }
  }

  private stopCamera(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  private scanLoop(): void {
    const video  = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;
    if (!video || !canvas || this.state !== 'scanning') return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx       = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // 'attemptBoth': megpróbálja normál és invertált QR kódokkal is
      // Lassabb mint a dontInvert, de sokkal megbízhatóbb
      const code      = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      });
      if (code?.data && code.data.trim() !== this.lastScannedHash) {
        this.lastScannedHash = code.data.trim();
        this.zone.run(() => this.onQrDetected(code.data.trim()));
        return;
      }
    }

    this.animFrameId = requestAnimationFrame(() => this.scanLoop());
  }

  private onQrDetected(hash: string): void {
    this.state = 'loading';
    this.stopCamera();
    this.http.get<PrizePocket>(`${this.apiBase}/preview/${hash}`, { headers: this.getHeaders() }).subscribe({
      next: (data) => {
        if (data.status === 'REDEEMED') {
          this.state        = 'error';
          this.errorMessage = 'Ezt a nyereményt már beváltották!';
          return;
        }
        this.pocket = data;
        this.state  = 'preview';
      },
      error: (err) => {
        this.state        = 'error';
        this.errorMessage = err.error || 'Érvénytelen vagy már beváltott QR kód!';
      }
    });
  }

  redeem(): void {
    if (!this.pocket || this.redeeming) return;
    this.redeeming    = true;
    const promoterId  = parseInt(localStorage.getItem('userId') || '0', 10);
    this.http.post<PrizePocket>(
      `${this.apiBase}/redeem`,
      { qrCodeHash: this.pocket.qrCodeHash, promoterId },
      { headers: this.getHeaders() }
    ).subscribe({
      next:  (data) => { this.pocket = data; this.redeeming = false; this.state = 'success'; },
      error: (err)  => { this.redeeming = false; this.state = 'error'; this.errorMessage = err.error || 'Beváltás sikertelen!'; }
    });
  }

  resetScanner(): void {
    this.pocket       = null;
    this.errorMessage = '';
    this.redeeming    = false;
    this.state        = 'scanning';
    setTimeout(() => {
      this.loadJsQR().then(() => this.startCamera());
      setTimeout(() => { this.lastScannedHash = ''; }, 1500);
    }, 100);
  }

  role = localStorage.getItem('role') || 'PROMOTER';

  logout(): void          { this.authService.logout(); }
  goTo(path: string): void { this.router.navigate([path]); }

  getPrizeName(): string {
    if (!this.pocket) return '';
    return this.pocket.inventoryItem?.name ?? 'Jäger Shot';
  }

  getPrizeIcon(): string {
    if (!this.pocket?.inventoryItem) return '🥃';
    return this.pocket.inventoryItem.liquid ? '🍶' : '🎁';
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}