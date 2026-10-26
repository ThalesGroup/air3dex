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
 * @file scaleControls.js
 * @description Initialise et gère les contrôles d'échelle dans l'interface, permettant le choix
 * du mode de contraste et la saisie manuelle des bornes avec une mise à jour dynamique de la légende.
 */

import { updateColorChart } from './chartAnalyzer.js';
import { refreshLegend } from './legendUpdater.js';
import { setManualBounds, setScaleMode } from './scaleModes.js';

let internalViewer = null;

/**
 * Initialise les contrôles d’échelle dans l’interface utilisateur et lie les événements.
 * @param {Cesium.Viewer} viewer - Instance du viewer Cesium
 */
export function initScaleControls(viewer) {
  const scaleSelect = document.getElementById('scale-mode');
  const manualInputs = document.getElementById('manual-scale-inputs');
  const manualMinInput = document.getElementById('manual-min');
  const manualMaxInput = document.getElementById('manual-max');
  const applyBtn = document.getElementById('apply-manual-scale');

  internalViewer = viewer;

  // Gestion du changement de mode d’échelle
  scaleSelect.addEventListener('change', () => {
    const mode = scaleSelect.value;
    setScaleMode(mode);
    manualInputs.style.display = (mode === 'manual') ? 'block' : 'none';
    refreshLegend(internalViewer);
    updateColorChart();
  });

  // Application de l’échelle manuelle
  applyBtn.addEventListener('click', () => {
    const min = parseFloat(manualMinInput.value);
    const max = parseFloat(manualMaxInput.value);
    if (!isNaN(min) && !isNaN(max) && max > min) {
      setManualBounds(min, max);
      refreshLegend(internalViewer);
      updateColorChart();

    } else {
      alert("Valeurs min/max invalides");
    }
  });
}
