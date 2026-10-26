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
 * @file isoViewToggle.js
 * @description Gère le basculement entre la vue Cesium classique et une visualisation isovolumique 
 * en 3D (via Three.js ou Babylon.js) selon l'intercation de l'utilisateur.
 */

import { initThreeView } from './isoThree.js';
import { initBabylonView } from './isoBabylon.js'

export function setupIsoViewToggle(jsonData) {
  const isoviewButton = document.getElementById('toggleViewBtn');
  const cesiumContainer = document.getElementById('cesiumContainer');
  const isoContainer = document.getElementById('isoContainer');

  let isIsoViewActive = false;

  isoviewButton.addEventListener('click', () => {
    if (isIsoViewActive) {
      isoContainer.style.display = 'none';
      cesiumContainer.style.display = 'block';
      isoviewButton.textContent = 'Isovolume View';
      isIsoViewActive = false;
    } else {
      isoContainer.style.display = 'block';
      cesiumContainer.style.display = 'none';
      isoviewButton.textContent = 'Cesium View';
      isIsoViewActive = true;

      initThreeView(jsonData);
      //initBabylonView(jsonData);
    }
  });
}