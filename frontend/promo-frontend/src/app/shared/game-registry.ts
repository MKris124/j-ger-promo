import { Type } from '@angular/core';
import { CatchTheJagerComponent } from '../pages/game/games/jager.component';
import { RideTheBusComponent } from '../pages/game/games/ride-the-bus.component';

export interface RegisteredGame {
  id: string;           // egyedi kulcs — ez kerül az adatbázisba gameKey-ként
  name: string;         // megjelenítendő név
  description: string;
  component: Type<any>; // Angular komponens referencia
}

export const GAME_REGISTRY: RegisteredGame[] = [
  {
    id: 'catch-the-jager',
    name: 'Kapd el a Jägert!',
    description: 'Töltsd tele a poharat 30 másodperc alatt',
    component: CatchTheJagerComponent,
  },
  {
    id: 'ride-the-bus',
    name: 'Jäger Busz',
    description: '4 szintes kártyajáték — shot vagy főnyeremény',
    component: RideTheBusComponent,
  },
  // Új játék hozzáadásához: importáld a komponenst és vedd fel ide
];

export function getGameById(id: string): RegisteredGame | undefined {
  return GAME_REGISTRY.find(g => g.id === id);
}