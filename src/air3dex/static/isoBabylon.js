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

export function initBabylonView(jsonData) {
  const container = document.getElementById('isoContainer');
  container.innerHTML = '';

  const engine = new BABYLON.Engine(container, true);
  const scene = new BABYLON.Scene(engine);

  scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1);

  const camera = new BABYLON.ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 20, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(container, true);

  const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(1, 1, 0), scene);
  light.intensity = 0.8;

  const directionalLight = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-1, -2, -1), scene);
  directionalLight.position = new BABYLON.Vector3(5, 10, 7.5);

  showWorldAxes(100, scene);




  const { positions, values, timestamps, seuil = 1 } = jsonData;

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
  const altScale = 0.5;
  const timeIndex = 0;
  const timestamp = timestamps[timeIndex];

  for (let i = 0; i < positions.length; i++) {
    const [x, y, z] = positions[i];
    const timeSeries = values[i];

    if (!Array.isArray(timeSeries) || timeSeries.length <= timeIndex) continue;

    const value = timeSeries[timeIndex];
    if (value === null || isNaN(value) || value < seuil) continue;

    const colorHex = getColor(value);
    const colorBabylon = BABYLON.Color3.FromHexString(colorHex);

    const sphere = BABYLON.MeshBuilder.CreateSphere(`sphere_${i}`, { diameter: 0.4 }, scene);
    sphere.position = new BABYLON.Vector3(
      (x - origin[0]) * scale,
      (z - origin[2]) * altScale,
      (y - origin[1]) * scale
    );

    const material = new BABYLON.StandardMaterial(`mat_${i}`, scene);
    material.diffuseColor = colorBabylon;
    sphere.material = material;
  }

  engine.runRenderLoop(() => {
    scene.render();
  });

  window.addEventListener('resize', () => {
    engine.resize();
  });
}

function getColor(value) {
  if (value > 100) return '#550a27';
  if (value > 75) return '#a3134d';
  if (value > 56) return '#ff1700';
  if (value > 50) return '#ff8300';
  if (value > 25) return '#e7d900';
  return '#009800';
}

function showWorldAxes(size, scene) {
  const makeAxis = (name, from, to, color) => {
    const axis = BABYLON.MeshBuilder.CreateLines(name, {
      points: [from, to],
    }, scene);
    axis.color = color;
  };

  makeAxis("X", new BABYLON.Vector3.Zero(), new BABYLON.Vector3(size, 0, 0), BABYLON.Color3.Red());
  makeAxis("Y", new BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, size, 0), BABYLON.Color3.Green());
  makeAxis("Z", new BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, 0, size), BABYLON.Color3.Blue());
}
