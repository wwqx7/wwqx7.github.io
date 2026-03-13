import { Shell, ShellType, TankModule, ModuleState } from './Types';

export class TankLogic {
  // Position & Rotation
  x: number = 0;
  y: number = 0; // Height
  z: number = 0;
  hullRotation: number = 0; // Radians
  turretRotation: number = 0; // Radians relative to hull
  gunElevation: number = 0; // Radians relative to turret

  // Speed constants
  baseMaxSpeedForward: number = 55 / 3.6; // m/s
  baseMaxSpeedReverse: number = 8 / 3.6; // m/s
  baseHullRotationSpeed: number = (4.2 * 2 * Math.PI) / 60; // rad/s
  turretRotationSpeed: number = (4.2 * 2 * Math.PI) / 60; // rad/s
  
  // Gun limits
  maxGunElevation: number = (20 * Math.PI) / 180;
  minGunElevation: number = (-5 * Math.PI) / 180;

  // State
  currentSpeed: number = 0;
  acceleration: number = 10; // m/s^2
  deceleration: number = 15; // m/s^2

  // Combat
  currentShell: Shell = new Shell(ShellType.AP);
  baseReloadTime: number = 5.0; // seconds
  currentReloadTime: number = 0;
  maxReloadTime: number = 5.0;
  isReloading: boolean = false;
  
  // Accuracy
  baseAimTime: number = 2.02; // seconds
  currentAimTime: number = 0;
  baseDispersion: number = 0.370; // m at 100m
  currentDispersion: number = 1.0; // Multiplier
  isMoving: boolean = false;

  // Abilities
  adrenalineActive: boolean = false;
  adrenalineTimer: number = 0;
  adrenalineDuration: number = 15; // seconds

  // Modules
  modules = {
    engine: new TankModule('Engine'),
    tracks: new TankModule('Tracks'),
    gun: new TankModule('Gun'),
    ammoRack: new TankModule('Ammo Rack')
  };

  update(dt: number, input: { w: boolean, s: boolean, a: boolean, d: boolean, targetTurretAngle: number, targetGunElevation: number }) {
    this.updateModules(dt);
    this.updateMovement(dt, input);
    this.updateTurret(dt, input);
    this.updateCombat(dt);
    this.updateAbilities(dt);
  }

  private updateModules(dt: number) {
    if (this.modules.tracks.state === ModuleState.DESTROYED) {
      this.modules.tracks.autoRepairTimer -= dt;
      if (this.modules.tracks.autoRepairTimer <= 0) {
        this.modules.tracks.state = ModuleState.DAMAGED;
      }
    }
  }

  private updateMovement(dt: number, input: { w: boolean, s: boolean, a: boolean, d: boolean }) {
    this.isMoving = false;

    let maxFwd = this.baseMaxSpeedForward;
    let maxRev = this.baseMaxSpeedReverse;
    let rotSpeed = this.baseHullRotationSpeed;

    if (this.modules.engine.state === ModuleState.DAMAGED || this.modules.engine.state === ModuleState.DESTROYED) {
      maxFwd *= 0.5;
      maxRev *= 0.5;
    }

    if (this.modules.tracks.state === ModuleState.DESTROYED) {
      maxFwd = 0;
      maxRev = 0;
      rotSpeed = 0;
    } else if (this.modules.tracks.state === ModuleState.DAMAGED) {
      maxFwd *= 0.5;
      maxRev *= 0.5;
      rotSpeed *= 0.5;
    }

    // Hull rotation
    if (input.a && rotSpeed > 0) {
      this.hullRotation += rotSpeed * dt;
      this.isMoving = true;
    }
    if (input.d && rotSpeed > 0) {
      this.hullRotation -= rotSpeed * dt;
      this.isMoving = true;
    }

    // Forward/Backward movement
    if (input.w && maxFwd > 0) {
      this.currentSpeed += this.acceleration * dt;
      if (this.currentSpeed > maxFwd) this.currentSpeed = maxFwd;
      this.isMoving = true;
    } else if (input.s && maxRev > 0) {
      this.currentSpeed -= this.acceleration * dt;
      if (this.currentSpeed < -maxRev) this.currentSpeed = -maxRev;
      this.isMoving = true;
    } else {
      // Friction/Deceleration
      if (this.currentSpeed > 0) {
        this.currentSpeed -= this.deceleration * dt;
        if (this.currentSpeed < 0) this.currentSpeed = 0;
      } else if (this.currentSpeed < 0) {
        this.currentSpeed += this.deceleration * dt;
        if (this.currentSpeed > 0) this.currentSpeed = 0;
      }
    }

    // Apply movement
    this.x += Math.sin(this.hullRotation) * this.currentSpeed * dt;
    this.z += Math.cos(this.hullRotation) * this.currentSpeed * dt;
  }

  private updateTurret(dt: number, input: { targetTurretAngle: number, targetGunElevation: number }) {
    let diff = input.targetTurretAngle - (this.hullRotation + this.turretRotation);
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    
    const maxRot = this.turretRotationSpeed * dt;
    if (Math.abs(diff) > 0.01) {
      this.isMoving = true;
      if (diff > 0) {
        this.turretRotation += Math.min(maxRot, diff);
      } else {
        this.turretRotation -= Math.min(maxRot, -diff);
      }
    }

    this.turretRotation = Math.atan2(Math.sin(this.turretRotation), Math.cos(this.turretRotation));

    let elDiff = input.targetGunElevation - this.gunElevation;
    const maxElRot = this.turretRotationSpeed * dt;
    if (Math.abs(elDiff) > 0.01) {
      if (elDiff > 0) {
        this.gunElevation += Math.min(maxElRot, elDiff);
      } else {
        this.gunElevation -= Math.min(maxElRot, -elDiff);
      }
    }

    if (this.gunElevation > this.maxGunElevation) this.gunElevation = this.maxGunElevation;
    if (this.gunElevation < this.minGunElevation) this.gunElevation = this.minGunElevation;
  }

  private updateCombat(dt: number) {
    if (this.isReloading) {
      this.currentReloadTime -= dt;
      if (this.currentReloadTime <= 0) {
        this.isReloading = false;
        this.currentReloadTime = 0;
      }
    }

    let aimTime = this.baseAimTime;
    if (this.modules.gun.state !== ModuleState.NORMAL) {
      aimTime *= 1.5;
    }

    if (this.isMoving) {
      this.currentAimTime = 0;
      this.currentDispersion = Math.min(this.currentDispersion + dt * 2, 3.0);
    } else {
      this.currentAimTime += dt;
      if (this.currentAimTime > aimTime) this.currentAimTime = aimTime;
      
      const aimProgress = this.currentAimTime / aimTime;
      this.currentDispersion = 3.0 - (2.0 * aimProgress);
    }
    
    if (this.modules.gun.state !== ModuleState.NORMAL) {
      this.currentDispersion *= 1.5;
    }
  }

  private updateAbilities(dt: number) {
    if (this.adrenalineActive) {
      this.adrenalineTimer -= dt;
      if (this.adrenalineTimer <= 0) {
        this.adrenalineActive = false;
      }
    }
  }

  fire(): Shell | null {
    if (this.isReloading) return null;

    let reloadTime = this.baseReloadTime;
    if (this.modules.ammoRack.state !== ModuleState.NORMAL) {
      reloadTime *= 1.5;
    }
    if (this.adrenalineActive) {
      reloadTime *= 0.85;
    }
    this.isReloading = true;
    this.currentReloadTime = reloadTime;
    this.maxReloadTime = reloadTime;

    this.currentDispersion = 3.0;
    this.currentAimTime = 0;

    return this.currentShell;
  }

  useRepairKit() {
    Object.values(this.modules).forEach(m => m.state = ModuleState.NORMAL);
  }

  useAdrenaline() {
    if (!this.adrenalineActive) {
      this.adrenalineActive = true;
      this.adrenalineTimer = this.adrenalineDuration;
    }
  }

  setShellType(type: ShellType) {
    this.currentShell = new Shell(type);
    if (!this.isReloading) {
       this.isReloading = true;
       let reloadTime = this.baseReloadTime;
       if (this.modules.ammoRack.state !== ModuleState.NORMAL) reloadTime *= 1.5;
       this.currentReloadTime = reloadTime;
       this.maxReloadTime = reloadTime;
    }
  }
  
  damageModule(moduleName: keyof typeof this.modules) {
    const mod = this.modules[moduleName];
    if (mod.state === ModuleState.NORMAL) {
      mod.state = ModuleState.DAMAGED;
    } else if (mod.state === ModuleState.DAMAGED) {
      mod.state = ModuleState.DESTROYED;
      if (moduleName === 'tracks') {
        mod.autoRepairTimer = 5.0;
      }
    }
  }
}
