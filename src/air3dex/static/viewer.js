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

/**
 * @file viewer.js
 * @description Initialise un viewer Cesium configuré avec terrain, atmosphère, timeline, etc.
 * Centre la caméra sur l'Europe et personnalise le comportement du bouton "maison".
 * Synchronise aussi la mini-carte Leaflet avec la position du viewer.
 *
 * @returns {Cesium.Viewer} Instance du viewer Cesium initialisé.
 */
export function initViewer() {
  const cesiumIonToken =
    globalThis.AIR3DEX_CONFIG?.cesiumIonToken?.trim();

  if (!cesiumIonToken) {
    throw new Error(
      "Jeton Cesium Ion manquant. Copiez config.example.js vers config.js, " +
      "puis renseignez cesiumIonToken."
    );
  }

  Cesium.Ion.defaultAccessToken = cesiumIonToken;

  const viewer = new Cesium.Viewer('cesiumContainer', {
    terrain: Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true }),
    timeline: true,
    animation: true,
    skyBox: false,
    skyAtmosphere: new Cesium.SkyAtmosphere(),
    useDefaultRenderLoop: true
  });

  viewer.scene.debugShowFramesPerSecond = true;
  viewer.scene.debugShowBoundingVolume = true;
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#0b1120");

  console.log(viewer.scene.context.webgl2 ? "WebGL 2.0" : "WebGL 1.0");

  const europePosition = Cesium.Cartesian3.fromDegrees(2.35, 48.85, 20000000); //20 000km d'altitude

  viewer.camera.setView({
    destination: europePosition
  });

  viewer.homeButton.viewModel.command.beforeExecute.addEventListener((commandInfo) => {
    viewer.camera.flyTo({
      destination: europePosition,
      duration: 2.0
    });
    commandInfo.cancel = true;
  });

  /* Création de la minimap avec Leaflet */
  const minimap = L.map('minimap', {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    touchZoom: false,
    keyboard: false,
    zoomSnap: 0.1
  }).setView([48.85, 2.35], 1);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 0,
    maxZoom: 50
  }).addTo(minimap);

  /**
   * Fonction pour convertir la hauteur de la caméra Cesium
   * en niveau de zoom Leaflet adapté pour la minimap.
   *
   * @param {number} height - Hauteur de la caméra en mètres
   * @returns {number} Niveau de zoom Leaflet
   */
  function cesiumHeightToLeafletZoom(height) {
    const maxZoom = 19;
    const minZoom = 1;
    const scale = Math.log2(20000000 / height); // 20M mètres ≈ zoom 1
    return Math.max(minZoom, Math.min(maxZoom, scale));
  }

  /* Synchronisation de la minimap Leaflet avec l'axe de vision de la caméra Cesium */
  viewer.camera.changed.addEventListener(() => {
    const center = new Cesium.Cartesian2(
      viewer.canvas.clientWidth / 2,
      viewer.canvas.clientHeight / 2
    );

    const ray = viewer.camera.getPickRay(center); // crée un rayon qui part du centre de l'écran vers la scène.
    const intersection = viewer.scene.globe.pick(ray, viewer.scene); // retourne l’intersection de ce rayon avec le globe (le point regardé).

    if (intersection) {
      const carto = Cesium.Cartographic.fromCartesian(intersection);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lon = Cesium.Math.toDegrees(carto.longitude);
      const height = viewer.camera.positionCartographic.height;

      const zoom = cesiumHeightToLeafletZoom(height);
      minimap.setView([lat, lon], zoom);
    }
  });

  return { viewer, minimap };
}
