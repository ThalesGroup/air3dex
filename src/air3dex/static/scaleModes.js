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
 * @file scaleModes.js 
 * @description Gère les différents modes de contraste de couleur (auto, manuel, percentile, référence)
 * pour la visualisation des données.
 */

import { colorRange } from './colorPalettes.js';

// Variables pour gérer le mode d’échelle et ses paramètres
export let scaleMode = 'auto';
export let manualMin = 0, manualMax = 100;
export let percentileMin = 0, percentileMax = 100;
export let autoMin = 0, autoMax = 100;

export let logBase = 10;
export let logMin = 0.01;
export let logMax = 2;

export function setScaleMode(mode) {
  scaleMode = mode;
}

export function setManualBounds(min, max) {
  manualMin = min;
  manualMax = max;
}

export function setPercentileBounds(min, max) {
  percentileMin = min;
  percentileMax = max;
}

export function setAutoBounds(min, max) {
  autoMin = min;
  autoMax = max;
}

export function setLogBounds(min, max, base = 10) {
  logMin = min;
  logMax = max;
  logBase = base;
}


export let currentVariable = '';

/**
 * Seuils de référence pour chaque variable environnementale.
 * Utilisés pour l’échelle 'reference' dans la coloration.
 */
export const referenceThresholds = {
  PM10: [0, 20, 40, 50, 100, 150],    // Matière particulaire < 10µg/m³
  //PM10: [0, 2, 4, 5, 10, 15],
  PMWF: [0, 20, 40, 50, 100, 150],
  DUST: [0, 20, 40, 50, 100, 150],
  PM2P5: [0, 10, 20, 25, 50, 75],     // Matière particulaire < 2.5µg/m³
  O3: [0, 50, 100, 130, 240, 380],    // Ozone
  SO2: [0, 100, 200, 350, 500, 750],  // Dioxyde de soufre
  NO2: [0, 40, 90, 120, 230, 340]     // Dioxyde d'azote
};

/**
 * Définit la variable environnementale actuellement sélectionnée
 * @param {string} variable - Nom de la variable (ex : 'PM10')
 */
export function setCurrentVariable(variable) {
  currentVariable = variable;
}

/**
 * Réinitialise les paramètres d’échelle à leur état par défaut (mode auto).
 */
export function resetScale() {
  scaleMode = 'auto';
  manualMin = 0;
  manualMax = 100;
  percentileMin = 0;
  percentileMax = 100;
  autoMin = 0;
  autoMax = 100;

  const scaleSelect = document.getElementById("scale-mode");
  if (scaleSelect) scaleSelect.value = "auto";

  const manualInputs = document.getElementById('manual-scale-inputs');
  if (manualInputs) manualInputs.style.display = 'none';
}

/**
 * Interpole une couleur dans la palette en fonction d’une valeur donnée et d’une plage [min, max].
 * @param {number} value - Valeur à colorer
 * @param {number} min - Valeur minimum de la plage
 * @param {number} max - Valeur maximum de la plage
 * @returns {Cesium.Color} - Couleur interpolée
 */
function interpolateColor(value, min, max) {
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const index = Math.floor(ratio * (colorRange.length - 1));
  const nextIndex = Math.min(index + 1, colorRange.length - 1);
  const t = (ratio * (colorRange.length - 1)) - index;

  const color1 = Cesium.Color.fromCssColorString(colorRange[index]);
  const color2 = Cesium.Color.fromCssColorString(colorRange[nextIndex]);

  return Cesium.Color.lerp(color1, color2, t, new Cesium.Color());
}

/**
 * Renvoie la couleur correspondant à une valeur selon le mode d’échelle en vigueur.
 * @param {number} value - Valeur pour laquelle on veut la couleur
 * @returns {Cesium.Color} - Couleur correspondante
 */
export function getColorForValue(value) {
  if (value === undefined || value === null || isNaN(value)) {
    return '#cccccc';
  }

  if (scaleMode === 'log') {
    // clamp et éviter les valeurs nulles ou négatives
    const v = Math.max(logMin, Math.min(value, logMax));
    const minLog = Math.log(logMin) / Math.log(logBase);
    const maxLog = Math.log(logMax) / Math.log(logBase);
    const vLog = Math.log(v) / Math.log(logBase);
    const ratio = (vLog - minLog) / (maxLog - minLog);
    return interpolateColor(ratio, 0, 1);
  }


  if (scaleMode === 'reference') {
    const thresholds = referenceThresholds[currentVariable];
    const colors = colorRange;

    if (!thresholds || !thresholds.length) {
      console.warn("Aucun seuil trouvé pour la variable :", currentVariable);
      return Cesium.Color.GRAY; // ou n’importe quelle couleur par défaut
    }

    for (let i = 0; i < thresholds.length - 1; i++) {
      if (value >= thresholds[i] && value <= thresholds[i + 1]) {
        const t = (value - thresholds[i]) / (thresholds[i + 1] - thresholds[i]);
        const color1 = Cesium.Color.fromCssColorString(colors[i]);
        const color2 = Cesium.Color.fromCssColorString(colors[i + 1]);
        return Cesium.Color.lerp(color1, color2, t, new Cesium.Color());
      }
    }

    // Valeur au-dessus du dernier seuil
    return Cesium.Color.fromCssColorString(colors[colors.length - 1]);
  }

  let min, max;

  if (scaleMode === 'manual') {
    min = manualMin;
    max = manualMax;
  } else if (scaleMode === 'percentile') {
    min = percentileMin;
    max = percentileMax;
  } else {
    min = autoMin;
    max = autoMax;
  }

  return interpolateColor(value, min, max);
}


export function getCurrentScaleBounds() {
  if (scaleMode === 'manual') {
    return [manualMin, manualMax];
  } else if (scaleMode === 'percentile') {
    return [percentileMin, percentileMax];
  } else if (scaleMode === 'log') {
    return [logMin, logMax];
  } else if (scaleMode === 'reference') {
    const thresholds = referenceThresholds[currentVariable];
    if (thresholds && thresholds.length) {
      return [thresholds[0], thresholds[thresholds.length - 1]];
    } else {
      return [0, 1]; // fallback
    }
  } else {
    return [autoMin, autoMax];
  }
}
