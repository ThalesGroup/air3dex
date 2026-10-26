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
 * @file main.js
 * @description Initialisation principale de l'application Cesium : création du viewer, surveillance 
 * des performances, gestion du formaulaire de données, configuration des événements UI et 
 * initialisation des contrôles d'échelles.
 */

import { initViewer } from './viewer.js';
import { monitorPerformance } from './perfMonitor.js';
import { handleDataForm } from './dataFormHandler.js';
import { setupUIEvents } from './uiEvents.js';
import { initScaleControls } from './scaleControls.js';
import { initColorPalettes } from './colorPalettes.js';


/**
 * Vérifie si le navigateur prend en charge WebGL.
 * 
 * Cette fonction tente de créer un élément <canvas> et d'obtenir un contexte WebGL.
 * Elle teste à la fois le contexte standard ('webgl') et le contexte de secours ('experimental-webgl')
 * pour assurer une compatibilité maximale avec les anciens navigateurs.
 * 
 * @returns {boolean} - true si WebGL est disponible et fonctionnel, false sinon.
 */
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch (e) {
    return false;
  }
}

// === Monkey patch / Debug WebGL ===
const originalGetContext = HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.getContext = function(type, ...args) {
  //console.log(`[WebGL Debug] getContext called with: ${type}`, this);
  return originalGetContext.call(this, type, ...args);
};

// === Vérification WebGL ===
console.log("WebGL disponible :", isWebGLAvailable());

if (!navigator.gpu) {
    console.error("WebGPU non supporté par ce navigateur.");
} else {
    console.log("WebGPU disponible !");
}


// === Point d'entrée principal ===
document.addEventListener("DOMContentLoaded", async () => {
  const { viewer, minimap } = initViewer();
  monitorPerformance(viewer);
  setupUIEvents();
  handleDataForm(viewer, minimap);
  initScaleControls(viewer);
  initColorPalettes();
});
