import * as THREE from 'three';

export class TargetLogic {
  x: number = 0;
  y: number = 1.2;
  z: number = -50;
  vx: number = 15; // m/s
  vz: number = 0;
  
  width: number = 3;
  height: number = 2.4;
  depth: number = 6;
  
  armorThickness: number = 100; // mm

  update(dt: number) {
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    if (this.x > 50) this.vx = -15;
    if (this.x < -50) this.vx = 15;
  }
}

export class TargetGraphics {
  group: THREE.Group;
  mesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    const geo = new THREE.BoxGeometry(3, 2.4, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xaa3333 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = 1.2;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    scene.add(this.group);
  }

  update(logic: TargetLogic) {
    this.group.position.set(logic.x, 0, logic.z);
    // Orient based on velocity
    this.group.rotation.y = Math.atan2(logic.vx, logic.vz);
  }
}
