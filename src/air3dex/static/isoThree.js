// Copyright (c) 2025-2026 Thales Services Numeriques (TSN).
 
// This file is part of Air3Dex
 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
 
//     http://www.apache.org/licenses/LICENSE-2.0
 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function initThreeView(jsonData) {
  const container = document.getElementById('isoContainer');
  container.innerHTML = '';

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(5, 5, 5);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.update();

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);
  scene.add(new THREE.AmbientLight(0x404040));
  scene.add(new THREE.AxesHelper(5));
  scene.add(new THREE.GridHelper(10, 10));

  const { positions, values, timestamps, seuil = 1 } = jsonData;

  // ✅ Vérification améliorée
  if (
    !Array.isArray(positions) ||
    !Array.isArray(values) ||
    !Array.isArray(timestamps) ||
    positions.length !== values.length ||
    timestamps.length === 0
  ) {
    console.error("❌ Données invalides ou mal structurées.");
    return;
  }

  const origin = positions[0];
  const scale = 5;

  // Choisir une tranche temporelle à afficher (ex: 0 = première heure)
  const timeIndex = 0; // Tu pourras le rendre dynamique via slider
  const timestamp = timestamps[timeIndex];

  for (let i = 0; i < positions.length; i++) {
    const [x, y, z] = positions[i];
    const timeSeries = values[i];

    if (!Array.isArray(timeSeries) || timeSeries.length <= timeIndex) continue;

    const value = timeSeries[timeIndex];
    if (value === null || isNaN(value) || value < seuil) continue;

    const color = new THREE.Color(getColor(value));
    const geometry = new THREE.SphereGeometry(0.2, 12, 12);
    const material = new THREE.MeshStandardMaterial({ color });
    const sphere = new THREE.Mesh(geometry, material);

    console.log(`Position: [${x}, ${y}, ${z}] -> Altitude: ${z}`);

    const altScale = 5;


    sphere.position.set(
      (x - origin[0]) * scale,
      (z - origin[2]) * scale * altScale,
      (y - origin[1]) * scale
    );

    scene.add(sphere);
  }
  

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

function getColor(value) {
  if (value > 100) return 0x550a27;
  if (value > 75) return 0xa3134d;
  if (value > 56) return 0xff1700;
  if (value > 50) return 0xff8300;
  if (value > 25) return 0xe7d900;
  return 0x009800;
}