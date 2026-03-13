import * as THREE from 'three';
import { TankLogic } from '../logic/Tank';
import { TankGraphics } from './TankGraphics';
import { CameraMode } from '../logic/Types';
import { TargetLogic, TargetGraphics } from '../logic/Target';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  tankGraphics: TankGraphics;
  targetGraphics: TargetGraphics;
  
  cameraMode: CameraMode = CameraMode.THIRD_PERSON;
  
  // Raycaster for aiming
  raycaster: THREE.Raycaster;
  targetPoint: THREE.Vector3;
  
  debugGroup: THREE.Group;
  velocityArrow: THREE.ArrowHelper;
  
  isDebugMode: boolean = false;

  constructor(canvas: HTMLCanvasElement, logic: TankLogic, targetLogic: TargetLogic) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.002);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(1000, 1000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x556B2F, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid helper for scale
    const grid = new THREE.GridHelper(1000, 100);
    this.scene.add(grid);

    // Add some obstacles
    for (let i = 0; i < 50; i++) {
      const boxGeo = new THREE.BoxGeometry(2 + Math.random() * 4, 2 + Math.random() * 4, 2 + Math.random() * 4);
      const boxMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set((Math.random() - 0.5) * 200, boxGeo.parameters.height / 2, (Math.random() - 0.5) * 200);
      box.castShadow = true;
      box.receiveShadow = true;
      this.scene.add(box);
    }

    this.tankGraphics = new TankGraphics(this.scene);
    this.targetGraphics = new TargetGraphics(this.scene);
    
    this.raycaster = new THREE.Raycaster();
    this.targetPoint = new THREE.Vector3(0, 0, 100);
    
    this.debugGroup = new THREE.Group();
    this.scene.add(this.debugGroup);
    this.debugGroup.visible = false;
    
    this.velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), 10, 0xff0000);
    this.debugGroup.add(this.velocityArrow);

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateCameraFromInput(logic: TankLogic, targetLogic: TargetLogic, cameraYaw: number, cameraPitch: number) {
    const tankPos = new THREE.Vector3(logic.x, logic.y, logic.z);
    
    if (this.cameraMode === CameraMode.THIRD_PERSON) {
      // Third person camera behind the tank
      const distance = 15;
      const height = 5;
      
      // Add Math.PI to cameraYaw so it's behind the look direction
      const camX = tankPos.x + Math.sin(cameraYaw + Math.PI) * distance * Math.cos(cameraPitch);
      const camY = Math.max(0.5, tankPos.y + height - Math.sin(cameraPitch) * distance);
      const camZ = tankPos.z + Math.cos(cameraYaw + Math.PI) * distance * Math.cos(cameraPitch);
      
      this.camera.position.set(camX, camY, camZ);
      
      // Look far ahead in the direction of the camera
      const lookDist = 500;
      const targetX = this.camera.position.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * lookDist;
      const targetY = this.camera.position.y + Math.sin(cameraPitch) * lookDist;
      const targetZ = this.camera.position.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * lookDist;
      this.camera.lookAt(targetX, targetY, targetZ);

      // Raycast from camera to find target point for turret
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera); // Center of screen
      
      // Check intersection with target
      const intersects = this.raycaster.intersectObject(this.targetGraphics.mesh);
      if (intersects.length > 0) {
        this.targetPoint.copy(intersects[0].point);
        
        // Lead calculation (Упреждение)
        const dist = this.camera.position.distanceTo(this.targetPoint);
        const flightTime = dist / logic.currentShell.speed;
        const targetVel = new THREE.Vector3(targetLogic.vx, 0, targetLogic.vz);
        
        // Adjust target point based on lead
        this.targetPoint.add(targetVel.multiplyScalar(flightTime));
      } else {
        // Intersect with ground
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.raycaster.ray.intersectPlane(plane, this.targetPoint);
        if (!this.targetPoint || this.targetPoint.distanceTo(tankPos) > 500) {
           this.targetPoint = new THREE.Vector3();
           this.raycaster.ray.at(500, this.targetPoint);
        }
      }

    } else if (this.cameraMode === CameraMode.SNIPER) {
      // Sniper mode: Camera at the gun mantlet, rotates freely
      const mantletPos = new THREE.Vector3();
      this.tankGraphics.gunGroup.getWorldPosition(mantletPos);
      this.camera.position.copy(mantletPos);
      
      // Look direction is controlled by mouse
      const lookDist = 500;
      const targetX = this.camera.position.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * lookDist;
      const targetY = this.camera.position.y + Math.sin(cameraPitch) * lookDist;
      const targetZ = this.camera.position.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * lookDist;
      this.camera.lookAt(targetX, targetY, targetZ);
      
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
      const intersects = this.raycaster.intersectObject(this.targetGraphics.mesh);
      if (intersects.length > 0) {
        this.targetPoint.copy(intersects[0].point);
        const dist = this.camera.position.distanceTo(this.targetPoint);
        const flightTime = dist / logic.currentShell.speed;
        const targetVel = new THREE.Vector3(targetLogic.vx, 0, targetLogic.vz);
        this.targetPoint.add(targetVel.multiplyScalar(flightTime));
      } else {
        this.targetPoint.set(targetX, targetY, targetZ);
      }
    }
  }

  getTargetAngles(logic: TankLogic): { targetTurretAngle: number, targetGunElevation: number } {
    // Calculate required turret angle and gun elevation to aim at targetPoint
    const dx = this.targetPoint.x - logic.x;
    const dz = this.targetPoint.z - logic.z;
    const dy = this.targetPoint.y - (logic.y + 1.6); // Turret height approx

    const distance = Math.sqrt(dx * dx + dz * dz);
    
    let targetTurretAngle = Math.atan2(dx, dz);
    let targetGunElevation = Math.atan2(dy, distance);

    return { targetTurretAngle, targetGunElevation };
  }
  
  getGunAimData(logic: TankLogic, targetLogic: TargetLogic) {
    const gunPos = new THREE.Vector3();
    this.tankGraphics.gunTip.getWorldPosition(gunPos);
    
    const gunDir = new THREE.Vector3(0, 0, 1);
    gunDir.applyQuaternion(this.tankGraphics.gunTip.getWorldQuaternion(new THREE.Quaternion())).normalize();
    
    this.raycaster.set(gunPos, gunDir);
    
    let hitPoint = new THREE.Vector3();
    let distance = 500;
    let targetHit = false;
    let effectiveArmor = 0;
    
    const intersects = this.raycaster.intersectObject(this.targetGraphics.mesh);
    if (intersects.length > 0) {
      hitPoint.copy(intersects[0].point);
      distance = intersects[0].distance;
      targetHit = true;
      
      const normal = intersects[0].face!.normal.clone();
      normal.transformDirection(this.targetGraphics.mesh.matrixWorld).normalize();
      const cosTheta = Math.abs(gunDir.dot(normal));
      effectiveArmor = targetLogic.armorThickness / (cosTheta === 0 ? 1 : cosTheta);
    } else {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const groundHit = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(plane, groundHit);
      
      if (groundHit && gunPos.distanceTo(groundHit) < 500 && gunDir.dot(groundHit.clone().sub(gunPos)) > 0) {
        hitPoint.copy(groundHit);
        distance = gunPos.distanceTo(hitPoint);
      } else {
        this.raycaster.ray.at(500, hitPoint);
        distance = 500;
      }
    }
    
    this.camera.updateMatrixWorld();
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
    
    const projected = hitPoint.clone().project(this.camera);
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (projected.y * -0.5 + 0.5) * window.innerHeight;
    
    const radius3D = (distance / 100) * logic.baseDispersion * logic.currentDispersion;
    const vFov = this.camera.fov * Math.PI / 180;
    const screenRadius = (radius3D / distance) * (window.innerHeight / (2 * Math.tan(vFov / 2)));
    
    return {
      x, y,
      radius: screenRadius,
      targetHit,
      effectiveArmor,
      inFront: projected.z <= 1.0
    };
  }

  render(logic: TankLogic, targetLogic: TargetLogic) {
    this.tankGraphics.update(logic);
    this.targetGraphics.update(targetLogic);
    
    if (this.isDebugMode) {
      this.debugGroup.visible = true;
      this.velocityArrow.position.set(targetLogic.x, targetLogic.y + 3, targetLogic.z);
      const vel = new THREE.Vector3(targetLogic.vx, 0, targetLogic.vz);
      if (vel.lengthSq() > 0) {
        this.velocityArrow.setDirection(vel.clone().normalize());
        this.velocityArrow.setLength(vel.length() / 2);
      }
    } else {
      this.debugGroup.visible = false;
    }
    
    this.renderer.render(this.scene, this.camera);
  }
}
