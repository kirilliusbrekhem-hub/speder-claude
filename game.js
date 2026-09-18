/*
 * SOLACE CITY — Web Runner
 * An original open-city web-swinging action prototype.
 * Hero: VOLT. No third-party characters, art, or assets are used.
 * Pure Three.js (r128) + vanilla JS, no build step required.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------
  const CFG = {
    gridRadius: 5,          // blocks from center in each direction
    blockSpacing: 46,
    streetHalfWidth: 9,
    gravity: 26,
    playerHeight: 1.8,
    playerRadius: 0.55,
    walkSpeed: 8,
    sprintSpeed: 13,
    airControl: 5,
    jumpSpeed: 10.5,
    swingMaxDist: 85,
    swingMinDist: 6,
    swingShortenRate: 4.5,
    swingSteerForce: 18,
    webMax: 100,
    webDrainPerSec: 14,
    webRegenPerSec: 9,
    meleeRange: 3.2,
    meleeArc: 0.62,          // dot-product threshold
    meleeDamage: 22,
    meleeCooldown: 0.42,
    comboWindow: 1.6,
    enemyTouchDamage: 9,
    enemyAttackCooldown: 1.3,
    enemyAggroRadius: 34,
    enemyAttackRadius: 2.6,
    enemySpeed: 6,
    respawnHealth: 55,
    maxHealth: 100,
    waves: [5, 8, 12],
  };

  const KEYS = {};
  const mouse = { dx: 0, dy: 0, leftDown: false, rightDown: false };

  // ---------------------------------------------------------------------
  // Renderer / Scene / Camera
  // ---------------------------------------------------------------------
  const canvas = document.getElementById('viewport');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1224);
  scene.fog = new THREE.FogExp2(0x0b1224, 0.0038);

  const camera = new THREE.PerspectiveCamera(
    68,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Lighting
  const hemi = new THREE.HemisphereLight(0x8fb8ff, 0x1a1030, 0.65);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe6c2, 1.05);
  sun.position.set(120, 220, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);

  // ---------------------------------------------------------------------
  // Ground
  // ---------------------------------------------------------------------
  const groundSize = (CFG.gridRadius * 2 + 2) * CFG.blockSpacing;
  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1c2136, roughness: 0.95 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // subtle street grid lines
  const gridHelper = new THREE.GridHelper(groundSize, groundSize / CFG.blockSpacing, 0x2c3352, 0x232941);
  gridHelper.position.y = 0.02;
  scene.add(gridHelper);

  // ---------------------------------------------------------------------
  // City generation
  // ---------------------------------------------------------------------
  const buildings = []; // { box: THREE.Box3, mesh }
  const buildingMeshes = [];

  function seededRand(seed) {
    let s = seed;
    return function () {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }
  const rand = seededRand(1337);

  const palette = [0x2a3350, 0x323a5c, 0x1f2740, 0x3a4468, 0x263056, 0x394270];
  const accentPalette = [0x3ad0ff, 0x7c4dff, 0xff4d9e, 0x4dff9e, 0xffd23a];

  function addBuilding(cx, cz) {
    const w = 10 + rand() * 12;
    const d = 10 + rand() * 12;
    const h = 14 + rand() * 62;
    const mat = new THREE.MeshStandardMaterial({
      color: palette[Math.floor(rand() * palette.length)],
      roughness: 0.8,
      metalness: 0.15,
    });
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    buildingMeshes.push(mesh);

    // neon window accent strip
    if (rand() > 0.4) {
      const accent = new THREE.Mesh(
        new THREE.BoxGeometry(w * 1.01, 1.2, d * 1.01),
        new THREE.MeshBasicMaterial({ color: accentPalette[Math.floor(rand() * accentPalette.length)] })
      );
      accent.position.set(cx, h * (0.35 + rand() * 0.5), cz);
      scene.add(accent);
    }

    // rooftop antenna occasionally
    if (rand() > 0.6) {
      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 6 + rand() * 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x555f7f })
      );
      antenna.position.set(cx + (rand() - 0.5) * w * 0.5, h + (3 + rand() * 4), cz + (rand() - 0.5) * d * 0.5);
      scene.add(antenna);
    }

    const box = new THREE.Box3().setFromObject(mesh);
    buildings.push({ box, top: h, cx, cz, halfW: w / 2, halfD: d / 2 });
  }

  for (let gx = -CFG.gridRadius; gx <= CFG.gridRadius; gx++) {
    for (let gz = -CFG.gridRadius; gz <= CFG.gridRadius; gz++) {
      if (gx === 0 && gz === 0) continue; // keep spawn plaza clear
      if (rand() < 0.08) continue; // occasional empty lot / plaza
      const jitterX = (rand() - 0.5) * 6;
      const jitterZ = (rand() - 0.5) * 6;
      addBuilding(gx * CFG.blockSpacing + jitterX, gz * CFG.blockSpacing + jitterZ);
    }
  }

  // Beacon tower — final objective, placed at the edge of the city
  const beaconPos = new THREE.Vector3(CFG.gridRadius * CFG.blockSpacing * 0.85, 0, CFG.gridRadius * CFG.blockSpacing * 0.85);
  const beaconTower = new THREE.Group();
  const beaconBody = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 6, 90, 8),
    new THREE.MeshStandardMaterial({ color: 0x2c3350, metalness: 0.3, roughness: 0.6 })
  );
  beaconBody.position.y = 45;
  beaconBody.castShadow = true;
  beaconTower.add(beaconBody);
  const beaconLight = new THREE.Mesh(
    new THREE.SphereGeometry(3, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd23a })
  );
  beaconLight.position.y = 94;
  beaconTower.add(beaconLight);
  const beaconGlow = new THREE.PointLight(0xffd23a, 2, 120);
  beaconGlow.position.y = 94;
  beaconTower.add(beaconGlow);
  beaconTower.position.copy(beaconPos);
  beaconTower.visible = false;
  scene.add(beaconTower);
  {
    const box = new THREE.Box3().setFromObject(beaconBody);
    box.translate(beaconPos);
    buildings.push({ box, top: 90, cx: beaconPos.x, cz: beaconPos.z, halfW: 6, halfD: 6 });
  }

  // ---------------------------------------------------------------------
  // Player — VOLT (original character, no third-party likeness)
  // ---------------------------------------------------------------------
  const player = new THREE.Group();
  player.position.set(0, 3, 0);
  scene.add(player);

  const suitMat = new THREE.MeshStandardMaterial({ color: 0x1b2440, roughness: 0.55, metalness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x3ad0ff, emissive: 0x0a3a52, roughness: 0.3 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 1.35, 8), suitMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  player.add(torso);
  const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), suitMat);
  shoulderCap.position.y = 1.05 + 0.675;
  shoulderCap.castShadow = true;
  player.add(shoulderCap);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), suitMat);
  head.position.y = 1.75;
  head.castShadow = true;
  player.add(head);

  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), accentMat);
  visor.position.y = 1.78;
  visor.rotation.x = 0.15;
  player.add(visor);

  const armGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.85, 6);
  const armL = new THREE.Mesh(armGeo, suitMat);
  armL.position.set(-0.55, 1.1, 0);
  armL.castShadow = true;
  player.add(armL);
  const armR = new THREE.Mesh(armGeo, suitMat);
  armR.position.set(0.55, 1.1, 0);
  armR.castShadow = true;
  player.add(armR);

  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.05), accentMat);
  chestStripe.position.set(0, 1.15, 0.4);
  player.add(chestStripe);

  const state = {
    velocity: new THREE.Vector3(),
    mode: 'air', // 'ground' | 'air' | 'swing'
    health: CFG.maxHealth,
    web: CFG.webMax,
    yaw: Math.PI,
    pitch: -0.15,
    swingAnchor: null,
    ropeLength: 0,
    attackCooldown: 0,
    invuln: 1.0,
    combo: 0,
    comboTimer: 0,
    grounded: false,
    facing: new THREE.Vector3(0, 0, -1),
  };

  // web rope visual
  const ropeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const ropeMat = new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.9 });
  const ropeLine = new THREE.Line(ropeGeo, ropeMat);
  ropeLine.visible = false;
  scene.add(ropeLine);

  // ---------------------------------------------------------------------
  // Enemies — Sentinel drones (original design)
  // ---------------------------------------------------------------------
  const enemies = [];

  function spawnEnemy(pos) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a1f2c, roughness: 0.5, metalness: 0.4 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4d5e });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), bodyMat);
    body.castShadow = true;
    group.add(body);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), eyeMat);
    eye.position.set(0, 0.1, 0.48);
    group.add(eye);

    const light = new THREE.PointLight(0xff4d5e, 0.8, 6);
    light.position.copy(eye.position);
    group.add(light);

    group.position.copy(pos);
    scene.add(group);

    enemies.push({
      group,
      health: 55,
      maxHealth: 55,
      state: 'patrol',
      patrolCenter: pos.clone(),
      patrolTarget: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14)),
      attackCooldown: 0,
      hitFlash: 0,
      dead: false,
    });
  }

  function groundHeightAt(x, z) {
    // returns the highest rooftop (or 0 for street) under x,z, ignoring a specific building
    let top = 0;
    for (const b of buildings) {
      if (x > b.cx - b.halfW && x < b.cx + b.halfW && z > b.cz - b.halfD && z < b.cz + b.halfD) {
        if (b.top > top) top = b.top;
      }
    }
    return top;
  }

  // ---------------------------------------------------------------------
  // Mission / wave manager
  // ---------------------------------------------------------------------
  const mission = {
    waveIndex: 0,
    toSpawn: 0,
    killedThisWave: 0,
    phase: 'wave', // 'wave' | 'beacon' | 'victory'
  };

  const missionTextEl = document.getElementById('missionText');
  const bannerEl = document.getElementById('bannerOverlay');
  const bannerTextEl = document.getElementById('bannerText');

  function showBanner(text) {
    bannerTextEl.textContent = text;
    bannerEl.classList.remove('hidden');
    // restart animation
    bannerTextEl.style.animation = 'none';
    void bannerTextEl.offsetWidth;
    bannerTextEl.style.animation = '';
    setTimeout(() => bannerEl.classList.add('hidden'), 2300);
  }

  function startWave(i) {
    mission.waveIndex = i;
    mission.killedThisWave = 0;
    const count = CFG.waves[i];
    mission.toSpawn = count;
    showBanner(`WAVE ${i + 1}: ${count} DRONES INBOUND`);
    for (let n = 0; n < count; n++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 60;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = groundHeightAt(x, z) + 1;
      spawnEnemy(new THREE.Vector3(x, y, z));
    }
    updateMissionText();
  }

  function updateMissionText() {
    if (mission.phase === 'wave') {
      const remaining = enemies.filter((e) => !e.dead).length;
      missionTextEl.textContent = `Wave ${mission.waveIndex + 1}/${CFG.waves.length} — Defeat remaining drones (${remaining} left)`;
    } else if (mission.phase === 'beacon') {
      missionTextEl.textContent = 'All waves cleared! Reach the glowing Beacon Tower.';
    } else if (mission.phase === 'victory') {
      missionTextEl.textContent = 'Solace City is safe. Well done, VOLT.';
    }
  }

  function onEnemyKilled() {
    mission.killedThisWave++;
    updateMissionText();
    const aliveCount = enemies.filter((e) => !e.dead).length;
    if (aliveCount === 0) {
      if (mission.waveIndex < CFG.waves.length - 1) {
        setTimeout(() => startWave(mission.waveIndex + 1), 2200);
      } else if (mission.phase === 'wave') {
        mission.phase = 'beacon';
        beaconTower.visible = true;
        showBanner('BEACON TOWER ACTIVATED — HEAD FOR THE LIGHT');
        updateMissionText();
      }
    }
  }

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------
  let paused = true;
  let started = false;

  document.addEventListener('keydown', (e) => {
    KEYS[e.code] = true;
    if (e.code === 'Escape' && started) togglePause();
  });
  document.addEventListener('keyup', (e) => { KEYS[e.code] = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (!started || paused) return;
    if (e.button === 0) mouse.leftDown = true;
    if (e.button === 2) mouse.rightDown = true;
  });
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.leftDown = false;
    if (e.button === 2) mouse.rightDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    mouse.dx += e.movementX || 0;
    mouse.dy += e.movementY || 0;
  });

  const startOverlay = document.getElementById('startOverlay');
  const pauseOverlay = document.getElementById('pauseOverlay');
  document.getElementById('startBtn').addEventListener('click', () => {
    startOverlay.classList.add('hidden');
    canvas.requestPointerLock();
    started = true;
    paused = false;
    clock.getDelta();
    if (mission.toSpawn === 0 && enemies.length === 0) startWave(0);
  });
  document.getElementById('resumeBtn').addEventListener('click', () => {
    togglePause();
  });

  function togglePause() {
    paused = !paused;
    if (paused) {
      pauseOverlay.classList.remove('hidden');
      document.exitPointerLock();
    } else {
      pauseOverlay.classList.add('hidden');
      canvas.requestPointerLock();
      clock.getDelta();
    }
  }

  canvas.addEventListener('click', () => {
    if (started && !paused && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  });

  // ---------------------------------------------------------------------
  // Physics helpers
  // ---------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();

  function resolveCityCollision(pos, vel, dt) {
    // Ground / rooftop support
    let supportTop = 0;
    for (const b of buildings) {
      const withinX = pos.x > b.cx - b.halfW - CFG.playerRadius && pos.x < b.cx + b.halfW + CFG.playerRadius;
      const withinZ = pos.z > b.cz - b.halfD - CFG.playerRadius && pos.z < b.cz + b.halfD + CFG.playerRadius;
      if (withinX && withinZ) {
        const feetY = pos.y - CFG.playerHeight / 2;
        if (b.top > supportTop && feetY >= b.top - 1.0) {
          supportTop = b.top;
        } else if (feetY < b.top && feetY + 1.2 > 0) {
          // side collision against a taller building: push out horizontally
          const dx = pos.x - b.cx;
          const dz = pos.z - b.cz;
          const overlapX = b.halfW + CFG.playerRadius - Math.abs(dx);
          const overlapZ = b.halfD + CFG.playerRadius - Math.abs(dz);
          if (overlapX > 0 && overlapZ > 0 && feetY < b.top - 0.2) {
            if (overlapX < overlapZ) {
              pos.x += Math.sign(dx || 1) * overlapX;
              vel.x = 0;
            } else {
              pos.z += Math.sign(dz || 1) * overlapZ;
              vel.z = 0;
            }
          }
        }
      }
    }
    const groundLevel = Math.max(supportTop, 0) + CFG.playerHeight / 2;
    if (pos.y <= groundLevel) {
      pos.y = groundLevel;
      if (vel.y < 0) vel.y = 0;
      state.grounded = true;
    } else {
      state.grounded = false;
    }
  }

  function findSwingAnchor() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = Math.max(dir.y, 0.15);
    dir.normalize();
    const origin = player.position.clone();
    origin.y += CFG.playerHeight * 0.6;
    raycaster.set(origin, dir);
    raycaster.far = CFG.swingMaxDist;
    const hits = raycaster.intersectObjects(buildingMeshes, false);
    if (hits.length > 0) {
      const hit = hits[0];
      if (hit.distance > CFG.swingMinDist) {
        return hit.point.clone();
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Combat
  // ---------------------------------------------------------------------
  function tryMeleeAttack() {
    if (state.attackCooldown > 0) return;
    state.attackCooldown = CFG.meleeCooldown;
    let hitSomething = false;
    for (const e of enemies) {
      if (e.dead) continue;
      const toEnemy = e.group.position.clone().sub(player.position);
      const dist = toEnemy.length();
      if (dist > CFG.meleeRange) continue;
      toEnemy.normalize();
      const facing = state.facing.clone().setY(0).normalize();
      const flat = toEnemy.clone().setY(0).normalize();
      if (facing.dot(flat) < CFG.meleeArc) continue;
      e.health -= CFG.meleeDamage;
      e.hitFlash = 0.15;
      const knock = flat.clone().multiplyScalar(4);
      e.group.position.add(knock.multiplyScalar(0.15));
      hitSomething = true;
      if (e.health <= 0 && !e.dead) {
        killEnemy(e);
      }
    }
    if (hitSomething) {
      state.combo++;
      state.comboTimer = CFG.comboWindow;
    } else {
      state.combo = 0;
    }
  }

  function killEnemy(e) {
    e.dead = true;
    scene.remove(e.group);
    onEnemyKilled();
  }

  // ---------------------------------------------------------------------
  // Camera rig
  // ---------------------------------------------------------------------
  const camOffset = new THREE.Vector3();
  function updateCamera() {
    const sensitivity = 0.0024;
    state.yaw -= mouse.dx * sensitivity;
    state.pitch -= mouse.dy * sensitivity;
    state.pitch = Math.max(-1.2, Math.min(1.0, state.pitch));
    mouse.dx = 0;
    mouse.dy = 0;

    state.facing.set(Math.sin(state.yaw), 0, Math.cos(state.yaw)).normalize();
    player.rotation.y = state.yaw;

    const dist = 7.5;
    camOffset.set(
      Math.sin(state.yaw) * Math.cos(state.pitch) * -dist,
      3.2 + Math.sin(state.pitch) * -dist,
      Math.cos(state.yaw) * Math.cos(state.pitch) * -dist
    );
    const desired = player.position.clone().add(camOffset);
    desired.y = Math.max(desired.y, groundHeightAt(desired.x, desired.z) + 1.2);
    camera.position.lerp(desired, 0.35);
    const lookTarget = player.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    camera.lookAt(lookTarget);
  }

  // ---------------------------------------------------------------------
  // Enemy AI
  // ---------------------------------------------------------------------
  function updateEnemies(dt) {
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      const toPlayer = player.position.clone().sub(e.group.position);
      const distToPlayer = toPlayer.length();

      if (e.state === 'patrol') {
        const toTarget = e.patrolTarget.clone().sub(e.group.position);
        toTarget.y = 0;
        if (toTarget.length() < 1) {
          e.patrolTarget = e.patrolCenter.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14));
        } else {
          toTarget.normalize();
          e.group.position.addScaledVector(toTarget, dt * 2.2);
          e.group.rotation.y = Math.atan2(toTarget.x, toTarget.z);
        }
        if (distToPlayer < CFG.enemyAggroRadius) e.state = 'chase';
      } else if (e.state === 'chase') {
        if (distToPlayer > CFG.enemyAggroRadius * 1.6) {
          e.state = 'patrol';
        } else if (distToPlayer < CFG.enemyAttackRadius) {
          e.state = 'attack';
        } else {
          const dir = toPlayer.clone().setY(0).normalize();
          e.group.position.addScaledVector(dir, dt * CFG.enemySpeed);
          e.group.rotation.y = Math.atan2(dir.x, dir.z);
        }
      } else if (e.state === 'attack') {
        e.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
        if (distToPlayer > CFG.enemyAttackRadius * 1.3) {
          e.state = 'chase';
        } else {
          e.attackCooldown -= dt;
          if (e.attackCooldown <= 0) {
            e.attackCooldown = CFG.enemyAttackCooldown;
            if (state.invuln <= 0) {
              damagePlayer(CFG.enemyTouchDamage);
            }
          }
        }
      }

      // keep enemies roughly on the ground/rooftop beneath them
      const supportY = groundHeightAt(e.group.position.x, e.group.position.z) + 0.5;
      e.group.position.y += (supportY - e.group.position.y) * Math.min(1, dt * 6);

      const mat = e.group.children[0].material;
      mat.emissive = mat.emissive || new THREE.Color(0);
      mat.color.setHex(e.hitFlash > 0 ? 0xffffff : 0x3a1f2c);
    }
  }

  function damagePlayer(amount) {
    state.health -= amount;
    state.invuln = 0.6;
    if (state.health <= 0) {
      respawnPlayer();
    }
  }

  function respawnPlayer() {
    state.health = CFG.respawnHealth;
    state.web = CFG.webMax;
    player.position.set(0, 5, 0);
    state.velocity.set(0, 0, 0);
    state.mode = 'air';
    state.swingAnchor = null;
    state.invuln = 1.5;
    showBanner('SYSTEMS REBOOTED — BACK IN ACTION');
  }

  // ---------------------------------------------------------------------
  // Main update
  // ---------------------------------------------------------------------
  const clock = new THREE.Clock();

  function updatePlayer(dt) {
    const moveX = (KEYS['KeyD'] ? 1 : 0) - (KEYS['KeyA'] ? 1 : 0);
    const moveZ = (KEYS['KeyW'] ? 1 : 0) - (KEYS['KeyS'] ? 1 : 0);
    const sprinting = !!KEYS['ShiftLeft'];

    const camForward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    const camRight = new THREE.Vector3(Math.sin(state.yaw + Math.PI / 2), 0, Math.cos(state.yaw + Math.PI / 2));
    const moveDir = new THREE.Vector3()
      .addScaledVector(camForward, moveZ)
      .addScaledVector(camRight, moveX);
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    if (state.mode === 'swing' && state.swingAnchor) {
      // pendulum physics via constrained verlet-style integration
      state.velocity.y -= CFG.gravity * dt;
      // steering
      state.velocity.addScaledVector(moveDir, CFG.swingSteerForce * dt);

      // optionally shorten rope to climb
      if (KEYS['KeyW']) state.ropeLength = Math.max(CFG.swingMinDist, state.ropeLength - CFG.swingShortenRate * dt);
      if (KEYS['KeyS']) state.ropeLength += CFG.swingShortenRate * dt;

      const prevPos = player.position.clone();
      const nextPos = prevPos.clone().addScaledVector(state.velocity, dt);
      const toNext = nextPos.clone().sub(state.swingAnchor);
      const dist = toNext.length();
      if (dist > 0.0001) {
        toNext.multiplyScalar(state.ropeLength / dist);
      }
      const corrected = state.swingAnchor.clone().add(toNext);
      state.velocity.copy(corrected.clone().sub(prevPos).divideScalar(Math.max(dt, 0.0001)));
      player.position.copy(corrected);

      if (player.position.y < 1.2) {
        player.position.y = 1.2;
        state.velocity.y = Math.max(state.velocity.y, 0);
      }

      if (!mouse.leftDown || KEYS['Space']) {
        state.mode = 'air';
        state.swingAnchor = null;
        ropeLine.visible = false;
        if (KEYS['Space']) state.velocity.y += 3;
      }
    } else {
      // ground / air movement
      const targetSpeed = sprinting ? CFG.sprintSpeed : CFG.walkSpeed;
      if (state.grounded) {
        state.velocity.x = moveDir.x * targetSpeed;
        state.velocity.z = moveDir.z * targetSpeed;
        if (KEYS['Space']) {
          state.velocity.y = CFG.jumpSpeed;
          state.grounded = false;
        }
      } else {
        state.velocity.x += moveDir.x * CFG.airControl * dt;
        state.velocity.z += moveDir.z * CFG.airControl * dt;
        const horizSpeed = Math.hypot(state.velocity.x, state.velocity.z);
        const maxAir = CFG.sprintSpeed * 1.1;
        if (horizSpeed > maxAir) {
          const scale = maxAir / horizSpeed;
          state.velocity.x *= scale;
          state.velocity.z *= scale;
        }
        state.velocity.y -= CFG.gravity * dt;
      }

      // attempt web-swing attach
      if (mouse.leftDown && !state.grounded && state.web > 5) {
        const anchor = findSwingAnchor();
        if (anchor) {
          state.swingAnchor = anchor;
          state.ropeLength = player.position.distanceTo(anchor);
          state.mode = 'swing';
        }
      }

      player.position.addScaledVector(state.velocity, dt);
      resolveCityCollision(player.position, state.velocity, dt);
      state.mode = state.grounded ? 'ground' : 'air';
    }

    // web fluid resource
    if (state.mode === 'swing') {
      state.web = Math.max(0, state.web - CFG.webDrainPerSec * dt);
      if (state.web <= 0) {
        state.mode = 'air';
        state.swingAnchor = null;
        ropeLine.visible = false;
      }
    } else if (state.grounded) {
      state.web = Math.min(CFG.webMax, state.web + CFG.webRegenPerSec * dt);
    }

    // rope visual
    if (state.mode === 'swing' && state.swingAnchor) {
      ropeLine.visible = true;
      const handPos = player.position.clone().add(new THREE.Vector3(0.5, 1.2, 0.2));
      ropeGeo.setFromPoints([handPos, state.swingAnchor]);
      ropeGeo.attributes.position.needsUpdate = true;
    } else {
      ropeLine.visible = false;
    }

    // clamp within world bounds (soft wall)
    const bound = (CFG.gridRadius + 1) * CFG.blockSpacing;
    player.position.x = Math.max(-bound, Math.min(bound, player.position.x));
    player.position.z = Math.max(-bound, Math.min(bound, player.position.z));

    // attack input
    if (KEYS['KeyF']) tryMeleeAttack();
    if (state.attackCooldown > 0) state.attackCooldown -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.invuln > 0) state.invuln -= dt;

    // beacon victory check
    if (mission.phase === 'beacon') {
      const d = player.position.distanceTo(beaconPos);
      if (d < 10) {
        mission.phase = 'victory';
        showBanner('VICTORY — SOLACE CITY IS SAFE');
        updateMissionText();
      }
    }
  }

  // ---------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------
  const healthFill = document.getElementById('healthBarFill');
  const webFill = document.getElementById('webBarFill');
  const comboBox = document.getElementById('comboBox');
  const comboCountEl = document.getElementById('comboCount');

  function updateHUD() {
    healthFill.style.width = `${Math.max(0, (state.health / CFG.maxHealth) * 100)}%`;
    webFill.style.width = `${Math.max(0, (state.web / CFG.webMax) * 100)}%`;
    if (state.combo > 1) {
      comboBox.classList.remove('hidden');
      comboCountEl.textContent = state.combo;
    } else {
      comboBox.classList.add('hidden');
    }
  }

  // ---------------------------------------------------------------------
  // Animate
  // ---------------------------------------------------------------------
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!started || paused) {
      renderer.render(scene, camera);
      return;
    }

    updatePlayer(dt);
    updateEnemies(dt);
    updateCamera();
    updateHUD();
    if (mission.phase === 'wave') updateMissionText();

    beaconLight.rotation.y += dt;

    renderer.render(scene, camera);
  }

  animate();
})();
