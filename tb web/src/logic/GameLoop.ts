import * as THREE from 'three';
import { TankLogic } from './Tank';
import { TargetLogic } from './Target';
import { SceneManager } from '../graphics/SceneManager';
import { CameraMode, Shell } from './Types';

class Projectile {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  shell: Shell;
  active: boolean = true;
  line: THREE.Line; // For debug trajectory
  points: THREE.Vector3[] = [];

  constructor(pos: THREE.Vector3, dir: THREE.Vector3, shell: Shell, sceneManager: SceneManager) {
    this.position = pos.clone();
    this.velocity = dir.clone().multiplyScalar(shell.speed);
    this.shell = shell;
    
    this.points.push(this.position.clone());
    const mat = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const geo = new THREE.BufferGeometry().setFromPoints(this.points);
    this.line = new THREE.Line(geo, mat);
    sceneManager.debugGroup.add(this.line);
  }
  
  update(dt: number, sceneManager: SceneManager, targetLogic: TargetLogic): any {
    if (!this.active) return null;
    
    const oldPos = this.position.clone();
    
    // Gravity (approx 9.8)
    this.velocity.y -= 9.8 * dt;
    
    this.position.add(this.velocity.clone().multiplyScalar(dt));
    
    this.points.push(this.position.clone());
    this.line.geometry.dispose();
    this.line.geometry = new THREE.BufferGeometry().setFromPoints(this.points);
    
    // Collision check
    const dir = this.position.clone().sub(oldPos);
    const dist = dir.length();
    dir.normalize();
    
    sceneManager.raycaster.set(oldPos, dir);
    const intersects = sceneManager.raycaster.intersectObject(sceneManager.targetGraphics.mesh);
    
    if (intersects.length > 0 && intersects[0].distance <= dist) {
      this.active = false;
      return { hit: true, point: intersects[0].point, normal: intersects[0].face!.normal, target: true };
    }
    
    if (this.position.y <= 0) {
      this.active = false;
      return { hit: true, point: this.position.clone(), target: false };
    }
    
    return null;
  }
}

export class GameLoop {
  logic: TankLogic;
  targetLogic: TargetLogic;
  sceneManager: SceneManager;
  lastTime: number = 0;
  
  keys = { w: false, s: false, a: false, d: false };
  cameraYaw: number = 0;
  cameraPitch: number = 0.2;
  
  projectiles: Projectile[] = [];
  
  onStateUpdate?: (logic: TankLogic, gunAimData?: any) => void;
  onHit?: (data: any) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.logic = new TankLogic();
    this.targetLogic = new TargetLogic();
    this.sceneManager = new SceneManager(canvas, this.logic, this.targetLogic);
    
    this.setupInput(canvas);
  }

  private setupInput(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyW') this.keys.w = true;
      if (e.code === 'KeyS') this.keys.s = true;
      if (e.code === 'KeyA') this.keys.a = true;
      if (e.code === 'KeyD') this.keys.d = true;
      if (e.code === 'ShiftLeft') {
        this.sceneManager.cameraMode = this.sceneManager.cameraMode === CameraMode.THIRD_PERSON 
          ? CameraMode.SNIPER 
          : CameraMode.THIRD_PERSON;
      }
      if (e.code === 'Digit0') {
        this.sceneManager.isDebugMode = !this.sceneManager.isDebugMode;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW') this.keys.w = false;
      if (e.code === 'KeyS') this.keys.s = false;
      if (e.code === 'KeyA') this.keys.a = false;
      if (e.code === 'KeyD') this.keys.d = false;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      } else {
        if (e.button === 0) {
          const shell = this.logic.fire();
          if (shell) {
            // Spawn projectile
            const gunPos = new THREE.Vector3();
            this.sceneManager.tankGraphics.gunTip.getWorldPosition(gunPos);
            
            const gunDir = new THREE.Vector3(0, 0, 1);
            gunDir.applyQuaternion(this.sceneManager.tankGraphics.gunTip.getWorldQuaternion(new THREE.Quaternion())).normalize();
            
            // Apply dispersion
            const dispAngle = (this.logic.baseDispersion / 100) * this.logic.currentDispersion;
            const randomAngle = Math.random() * Math.PI * 2;
            const randomRadius = Math.random() * dispAngle;
            
            // Create a perpendicular vector for dispersion
            const perp1 = new THREE.Vector3(1, 0, 0).cross(gunDir).normalize();
            if (perp1.lengthSq() < 0.01) perp1.set(0, 0, 1).cross(gunDir).normalize();
            const perp2 = gunDir.clone().cross(perp1).normalize();
            
            perp1.multiplyScalar(Math.cos(randomAngle) * randomRadius);
            perp2.multiplyScalar(Math.sin(randomAngle) * randomRadius);
            
            gunDir.add(perp1).add(perp2).normalize();
            
            this.projectiles.push(new Projectile(gunPos, gunDir, shell, this.sceneManager));
          }
        }
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        const sens = 0.002;
        this.cameraYaw += e.movementX * sens;
        this.cameraPitch -= e.movementY * sens;
        
        if (this.cameraPitch > Math.PI / 2 - 0.1) this.cameraPitch = Math.PI / 2 - 0.1;
        if (this.cameraPitch < -Math.PI / 2 + 0.1) this.cameraPitch = -Math.PI / 2 + 0.1;
      }
    });
  }

  start() {
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  private loop(time: number) {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const safeDt = Math.min(dt, 0.1);

    this.targetLogic.update(safeDt);

    this.sceneManager.updateCameraFromInput(this.logic, this.targetLogic, this.cameraYaw, this.cameraPitch);
    const targetAngles = this.sceneManager.getTargetAngles(this.logic);

    this.logic.update(safeDt, {
      ...this.keys,
      targetTurretAngle: targetAngles.targetTurretAngle,
      targetGunElevation: targetAngles.targetGunElevation
    });
    
    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const hitData = p.update(safeDt, this.sceneManager, this.targetLogic);
      if (hitData) {
        if (hitData.target) {
          const damage = p.shell.calculateDamage();
          
          // Calculate effective armor
          const impactDir = p.velocity.clone().normalize();
          const normal = hitData.normal as THREE.Vector3;
          // transform normal to world space
          normal.transformDirection(this.sceneManager.targetGraphics.mesh.matrixWorld).normalize();
          
          const cosTheta = Math.abs(impactDir.dot(normal));
          const effectiveArmor = this.targetLogic.armorThickness / (cosTheta === 0 ? 1 : cosTheta);
          
          // Random module damage
          const modules = ['engine', 'tracks', 'gun', 'ammoRack'];
          const hitModule = modules[Math.floor(Math.random() * modules.length)] as keyof typeof this.logic.modules;
          this.logic.damageModule(hitModule);
          
          if (this.onHit) {
            this.onHit({
              damage,
              point: hitData.point,
              effectiveArmor: Math.round(effectiveArmor),
              module: hitModule
            });
          }
        }
        this.projectiles.splice(i, 1);
      }
    }

    this.sceneManager.render(this.logic, this.targetLogic);

    if (this.onStateUpdate) {
      const gunAimData = this.sceneManager.getGunAimData(this.logic, this.targetLogic);
      this.onStateUpdate(this.logic, gunAimData);
    }

    requestAnimationFrame(this.loop.bind(this));
  }
}
