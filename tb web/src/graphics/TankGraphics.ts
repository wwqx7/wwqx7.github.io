import * as THREE from 'three';
import { TankLogic } from '../logic/Tank';

export class TankGraphics {
  group: THREE.Group;
  hull: THREE.Mesh;
  turretGroup: THREE.Group;
  turret: THREE.Mesh;
  gunGroup: THREE.Group;
  mantlet: THREE.Mesh;
  barrel: THREE.Mesh;
  gunTip: THREE.Object3D;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();

    // Materials
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x4B5320, roughness: 0.9, metalness: 0.1 }); // Dark olive green
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1.0 }); // Dark gray/black
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x3A4310, roughness: 0.8, metalness: 0.2 });

    // Hull (T-34-85) - Unified mesh with sloped glacis
    const hullGeo = new THREE.BoxGeometry(3.2, 1.2, 6.8);
    const pos = hullGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      
      // Top-front vertices (Upper Glacis)
      if (y > 0.1 && z > 0.1) {
        pos.setZ(i, z - 2.0); // Slant backwards
        pos.setY(i, y - 0.2); // Lower the front nose slightly
      }
      // Bottom-front vertices (Lower Glacis)
      if (y < -0.1 && z > 0.1) {
        pos.setZ(i, z - 0.4); 
      }
      // Top-rear vertices (Engine deck slope)
      if (y > 0.1 && z < -0.1) {
        pos.setZ(i, z + 0.8);
        pos.setY(i, y - 0.1);
      }
    }
    hullGeo.computeVertexNormals();

    this.hull = new THREE.Mesh(hullGeo, hullMat);
    this.hull.position.y = 0.9; // Raised above ground
    this.hull.castShadow = true;
    this.hull.receiveShadow = true;
    this.group.add(this.hull);

    // Tracks - Wider and darker
    const trackGeo = new THREE.BoxGeometry(0.8, 1.2, 7.8);
    const leftTrack = new THREE.Mesh(trackGeo, trackMat);
    leftTrack.position.set(-1.8, 0.6, 0.0);
    leftTrack.castShadow = true;
    leftTrack.receiveShadow = true;
    this.group.add(leftTrack);
    
    const rightTrack = new THREE.Mesh(trackGeo, trackMat);
    rightTrack.position.set(1.8, 0.6, 0.0);
    rightTrack.castShadow = true;
    rightTrack.receiveShadow = true;
    this.group.add(rightTrack);

    // Turret Group (rotates around Y)
    this.turretGroup = new THREE.Group();
    this.turretGroup.position.set(0, 1.45, 0.8); // Shifted forward, lowered to sit on hull
    this.group.add(this.turretGroup);

    // Turret Mesh (Flattened Sphere)
    const turretGeo = new THREE.SphereGeometry(1.5, 32, 16);
    this.turret = new THREE.Mesh(turretGeo, hullMat);
    this.turret.scale.set(1.2, 0.7, 1.2); // Flattened on Y axis
    this.turret.castShadow = true;
    this.turret.receiveShadow = true;
    this.turretGroup.add(this.turret);

    // Gun Group / Mantlet Pivot (rotates around X for elevation)
    this.gunGroup = new THREE.Group();
    this.gunGroup.position.set(0, 0.2, 1.6); // Front of turret
    this.turretGroup.add(this.gunGroup);

    // Mantlet (Mask)
    const mantletGeo = new THREE.BoxGeometry(1.0, 0.8, 1.2);
    this.mantlet = new THREE.Mesh(mantletGeo, hullMat);
    this.mantlet.castShadow = true;
    this.mantlet.receiveShadow = true;
    this.gunGroup.add(this.mantlet);

    // Barrel (85mm ZIS-S-53)
    const barrelGeo = new THREE.CylinderGeometry(0.1, 0.15, 5.0, 16);
    barrelGeo.rotateX(Math.PI / 2); // Point forward
    barrelGeo.translate(0, 0, 2.5 + 0.6); // Move origin to base (half length + half mantlet)
    this.barrel = new THREE.Mesh(barrelGeo, gunMat);
    this.barrel.castShadow = true;
    this.barrel.receiveShadow = true;
    this.gunGroup.add(this.barrel);

    // Gun Tip
    this.gunTip = new THREE.Object3D();
    this.gunTip.position.set(0, 0, 5.0 + 0.6); // End of the barrel
    this.barrel.add(this.gunTip);

    scene.add(this.group);
  }

  update(logic: TankLogic) {
    // Position
    this.group.position.set(logic.x, logic.y, logic.z);
    
    // Hull rotation (Y axis)
    this.group.rotation.y = logic.hullRotation;

    // Turret rotation (Y axis relative to hull)
    this.turretGroup.rotation.y = logic.turretRotation;

    // Gun elevation (X axis relative to turret)
    // In Three.js, positive X rotation pitches down, so we might need to negate
    this.gunGroup.rotation.x = -logic.gunElevation;
  }
}
