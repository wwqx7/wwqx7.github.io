export enum ShellType {
  AP = 'ББ',
  APCR = 'БП',
  HE = 'ОФ'
}

export class Shell {
  type: ShellType;
  baseDamage: number;
  speed: number;
  penetration: number;

  constructor(type: ShellType) {
    this.type = type;
    this.baseDamage = type === ShellType.HE ? 300 : 200;
    if (type === ShellType.AP) {
      this.speed = 800;
      this.penetration = 150;
    } else if (type === ShellType.APCR) {
      this.speed = 1100;
      this.penetration = 220;
    } else {
      this.speed = 600;
      this.penetration = 50;
    }
  }

  calculateDamage(): number {
    const spread = this.baseDamage * 0.25;
    const randomFactor = (Math.random() * 2 - 1) * spread;
    return Math.round(this.baseDamage + randomFactor);
  }
}

export enum CameraMode {
  THIRD_PERSON,
  SNIPER
}

export enum ModuleState {
  NORMAL,
  DAMAGED,
  DESTROYED
}

export class TankModule {
  name: string;
  state: ModuleState = ModuleState.NORMAL;
  autoRepairTimer: number = 0;

  constructor(name: string) {
    this.name = name;
  }
}
