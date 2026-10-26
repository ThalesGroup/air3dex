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
 * @file legendUpdater.js
 * @description Met à jour dynamiquement les bornes de la légende selon les données et le mode d'échelle
 * actif (manuel, auto, percentile ou référence), avec prise en charge de CZML et JSON.
 */

import {
  currentVariable,
  logMax,
  logMin,
  manualMax,
  manualMin,
  referenceThresholds,
  scaleMode,
  setAutoBounds,
  setPercentileBounds
} from './scaleModes.js';

let currentDataSource = null;
let currentMode = null;
let refreshing = false;

let decimals = 2;
let useExponential = false;

/**
 * Définit la source de données active et son mode.
 * @param {any} dataSource - Source de données active (CZML, JSON, etc.)
 * @param {string} mode - Mode de données (ex : 'czml', 'json')
 */
export function setCurrentData(dataSource, mode) {
  currentDataSource = dataSource;
  currentMode = mode;
}

/**
 * Met à jour la légende affichée à l’écran en fonction des données et du mode actif.
 * @param {any} dataSource - Source de données à analyser
 * @param {string} mode - Mode des données ('czml', 'json', ...)
 */
export function updateLegend(dataSource, mode) {
  if (!dataSource || typeof dataSource !== 'object') return;
  //console.log("dataSource.values =", dataSource.values);

  const legendMin = document.getElementById('min-value');
  const legendMax = document.getElementById('max-value');

  let vals = [];
  let unit = null;

  // Récupération des valeurs selon le type
  if (mode === 'czml') {
    if (!dataSource.entities || !Array.isArray(dataSource.entities.values)) {
      console.warn("Aucune entité trouvée dans le fichier CZML.");
      return;
    }
    dataSource.entities.values.forEach(ent => {
      if (Cesium.defined(ent.properties?.value)) {
        const v = ent.properties.value.getValue(Cesium.JulianDate.now());
        if (!isNaN(v)) vals.push(+v);
        if (!unit && Cesium.defined(ent.properties.unit)) {
          unit = ent.properties.unit.getValue(Cesium.JulianDate.now());
        }
      } else if (ent.name) {
        const match = ent.name.match(/([\d.]+)\s*([^\s]+)/);
        if (match) {
          vals.push(parseFloat(match[1]));
          if (!unit) unit = match[2];
        }
      }
    });
    unit = (unit || '').replace('m3', 'm\u00B3');

  } else if (mode === 'json') {
    if (!dataSource || !dataSource.values) return;
    unit = dataSource.units || "";
    unit = unit.replace("m3", "m\u00B3");

    for (let i = 0; i < dataSource.values.length; i++) {
      const timeSeries = dataSource.values[i];
      if (!Array.isArray(timeSeries)) continue;

      for (let j = 0; j < timeSeries.length; j++) {
        const val = timeSeries[j];
        if (typeof val === 'number' && !isNaN(val)) {
          vals.push(val);
        }
      }
    }
  }

  if (!vals.length) return;

  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }

  // Application des modes d’échelle
  if (scaleMode === 'manual') {
    minVal = manualMin;
    maxVal = manualMax;

  } else if (scaleMode === 'log') {
    minVal = logMin;
    maxVal = logMax;

  } else if (scaleMode === 'reference') {
    const thresholds = referenceThresholds[currentVariable];
    minVal = thresholds[0];
    maxVal = thresholds[thresholds.length - 1];

  } else if (scaleMode === 'percentile') {
    vals.sort((a, b) => a - b);
    const p2Index = Math.floor(0.02 * (vals.length - 1));
    const p98Index = Math.ceil(0.98 * (vals.length - 1));
    minVal = vals[p2Index];
    maxVal = vals[p98Index];
    setPercentileBounds(minVal, maxVal);
    
  } else {
    setAutoBounds(minVal, maxVal);
  }

  legendMin.textContent = `${formatNumber(minVal)} ${unit || ''}`;
  legendMax.textContent = `${formatNumber(maxVal)} ${unit || ''}`;
}

function formatNumber(val) {
  if (!Number.isFinite(val)) return "—";
  return useExponential ? val.toExponential(decimals) : val.toFixed(decimals);
}

// Event listeners pour l’UI (comme pour stats)
document.getElementById("decimals").addEventListener("input", (e) => {
  decimals = parseInt(e.target.value) || 2;
  refreshLegend(); // rafraîchit la légende avec le nouveau format
});

document.getElementById("notation").addEventListener("change", (e) => {
  useExponential = (e.target.value === "exp");
  refreshLegend();
});

/**
 * Force la mise à jour de la légende dans l’interface utilisateur.
 * @param {Cesium.Viewer} viewer - Instance du viewer Cesium
 */
export function refreshLegend(viewer) {
  console.log("refreshLegend called");
  if (refreshing) return;
  refreshing = true;

  try {
    if (viewer && viewer.clock) {
      const currentTime = viewer.clock.currentTime;
      viewer.clock.currentTime = Cesium.JulianDate.addSeconds(currentTime, 0.001, new Cesium.JulianDate());
    }

    if (!currentDataSource || !currentMode) {
      alert("Aucune donnée chargée à actualiser.");
      return;
    }

    updateLegend(currentDataSource, currentMode);
  } finally {
    refreshing = false;
  }
}
