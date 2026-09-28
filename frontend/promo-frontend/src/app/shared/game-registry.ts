import { Type } from '@angular/core';
import { CatchTheJagerComponent } from '../pages/game/games/catch-the-jager/jager.component';
import { RideTheBusComponent } from '../pages/game/games/ride-the-bus/ride-the-bus.component';
import { SlotMachineComponent } from '../pages/game/games/slot-machine/slot-machine.component';
import { WhacAMoleComponent } from '../pages/game/games/whac-a-mole/whac-a-mole.component';

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
  {
    id: 'slot-machine',
    name: 'Jäger Nyerőgép',
    description: '3 azonos szarvas = nyeremény',
    component: SlotMachineComponent,
  },
  {
    id: 'whac-a-mole',
    name: 'Üsd a Szarvast!',
    description: 'Csapj a szarvasokra, kerüld a törött poharat — 30 mp',
    component: WhacAMoleComponent,
  },
  // Új játék hozzáadásához: importáld a komponenst és vedd fel ide
];

export function getGameById(id: string): RegisteredGame | undefined {
  return GAME_REGISTRY.find(g => g.id === id);
}