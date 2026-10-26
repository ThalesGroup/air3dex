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
 * @file perfMonitor.js
 * @description Affiche en temps réel les performances du viewer Cesium (FPS, nombre de tuiles
 * en cours de chargement, et mémoire JS utilisée).
 */

/**
 * Affiche les performances du viewer Cesium (FPS, tiles restantes, mémoire JS).
 * 
 * @param {Cesium.Viewer} viewer - Instance du viewer Cesium.
 */
export function monitorPerformance(viewer) {
  const frm = Cesium.FrameRateMonitor.fromScene(viewer.scene, { samplingWindow: 2 });
  setInterval(() => {
    const fps = frm.lastFramesPerSecond ?? 0;
    document.getElementById('fps').textContent = `FPS ${fps.toFixed(1)}`;
  }, 1000);

  viewer.scene.globe.tileLoadProgressEvent.addEventListener((n) => {
    document.getElementById('tilesLeft').textContent = `Tiles ${n}`;
  });

  if (performance.memory) {
    setInterval(() => {
      const used = performance.memory.usedJSHeapSize / 1048576;
      document.getElementById('jsHeap').textContent = `JS ${used.toFixed(0)} MB`;
    }, 2000);
  }
}
