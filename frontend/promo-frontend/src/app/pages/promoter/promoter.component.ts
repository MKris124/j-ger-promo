import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { environment } from '../../../environments/environments';

// jsQR-t npm install jsqr paranccsal kell telepíteni
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
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private zone = inject(NgZone);
  private router = inject(Router);

  private apiBase = `${environment.apiUrl}/api/promoter`;

  @ViewChild('videoEl', { static: false }) videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl', { static: false }) canvasEl!: ElementRef<HTMLCanvasElement>;

  state: ScanState = 'scanning';
  pocket: PrizePocket | null = null;
  errorMessage = '';
  redeeming = false;

  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private lastScannedHash = '';

  ngOnInit(): void {
    this.loadJsQR().then(() => this.startCamera());
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  private loadJsQR(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof jsQR !== 'undefined') { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  private async startCamera() {
    try {
      // 1. iOS trükk: Először kérnünk kell egy sima engedélyt, 
      // különben az Apple titkosítja a kamerák neveit (üres stringeket ad vissza).
      const initialStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      
      // 2. Lekérjük a telefonhoz csatlakoztatott összes eszközt
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      let optimalDeviceId: string | null = null;

      // 3. Megpróbáljuk megtalálni a tökéletes fő kamerát
      if (videoDevices.length > 0) {
        // Kiválogatjuk a hátsó kamerákat név alapján
        const rearCameras = videoDevices.filter(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear')
        );

        if (rearCameras.length > 0) {
          // Keresünk egy olyat, aminek a nevében NINCS benne, hogy ultra, tele, vagy 0.5
          const mainCamera = rearCameras.find(d => 
            !d.label.toLowerCase().includes('ultra') && 
            !d.label.toLowerCase().includes('tele') &&
            !d.label.toLowerCase().includes('macro')
          );
          
          // Ha megtaláltuk a fő kamerát, használjuk azt, ha nem, marad az első hátsó
          optimalDeviceId = mainCamera ? mainCamera.deviceId : rearCameras[0].deviceId;
        }
      }

      // 4. Leállítjuk a kezdeti "teszt" streamet, hogy ne foglalja a memóriát
      initialStream.getTracks().forEach(track => track.stop());

      // 5. Elindítjuk a VÉGLEGES streamet a tökéletes kamerával
      const constraints: MediaStreamConstraints = {
        video: optimalDeviceId 
          ? { deviceId: { exact: optimalDeviceId } } 
          : { facingMode: 'environment' } // Fallback, ha valamiért nem sikerülne az azonosítás
      };

      const finalStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // videoEl a @ViewChild('videoEl') változód! Ezt írd át arra, ahogy nálad hívják, ha eltér.
      this.videoEl.nativeElement.srcObject = finalStream;
      
      // Innentől folytatódik az eredeti kódod (pl. requestAnimationFrame)
      // this.scanQRCode(); vagy ami nálad volt...

    } catch (error) {
      console.error("Hiba a kamera indításakor:", error);
      this.errorMessage = 'Nem sikerült hozzáférni a kamerához. Ellenőrizd a jogosultságokat!';
      this.state = 'error';
    }
  }

  private stopCamera(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  private scanLoop(): void {
    const video = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;
    if (!video || !canvas || this.state !== 'scanning') return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
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
          this.state = 'error';
          this.errorMessage = 'Ezt a nyereményt már beváltották!';
          return;
        }
        this.pocket = data;
        this.state = 'preview';
      },
      error: (err) => { this.state = 'error'; this.errorMessage = err.error || 'Érvénytelen vagy már beváltott QR kód!'; }
    });
  }

  redeem(): void {
    if (!this.pocket || this.redeeming) return;
    this.redeeming = true;
    const promoterId = parseInt(localStorage.getItem('userId') || '0', 10);
    this.http.post<PrizePocket>(`${this.apiBase}/redeem`,
      { qrCodeHash: this.pocket.qrCodeHash, promoterId },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (data) => { this.pocket = data; this.redeeming = false; this.state = 'success'; },
      error: (err) => { this.redeeming = false; this.state = 'error'; this.errorMessage = err.error || 'Beváltás sikertelen!'; }
    });
  }

  resetScanner(): void {
    this.pocket = null;
    this.errorMessage = '';
    this.redeeming = false;
    this.state = 'scanning';
    // lastScannedHash-t csak a kamera újraindulása UTÁN töröljük
    // hogy ne kapja el azonnal ugyanazt a kódot
    setTimeout(() => {
      this.loadJsQR().then(() => this.startCamera());
      setTimeout(() => { this.lastScannedHash = ''; }, 1500);
    }, 100);
  }

  role = localStorage.getItem('role') || 'PROMOTER';

  logout(): void { this.authService.logout(); }
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