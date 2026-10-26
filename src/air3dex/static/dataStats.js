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
 * @file dataStats.js
 * @description Calcule les statistiques de base (min, max, moyenne et écart-type) 
 * à partir des données et les affiche dans l'UI.
 */


let decimals = 2;
let lastData = null;
let useExponential = false;


/**
 * Calcule et met à jour les statistiques (min, max, moyenne, écart-type) des données fournies.
 * @param {Object} data - Objet contenant les données.
 * @param {Array<Array<number>>} data.values - Tableau 2D des valeurs numériques.
 */
export function updateStats(data) {
  if (data) lastData = data;
  const values = data.values?.flat(); // Aplatissement pour avoir un tableau 1D
  //console.log(values);

  let unit = data.units || "";
  unit = unit.replace("m3", "m\u00B3");
  console.log(unit);

  if (!values || values.length === 0) return;

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (typeof val !== "number" || isNaN(val)) continue;

    if (val < min) min = val;
    if (val > max) max = val;
    sum += val;
    count++;
  }

  const mean = sum / count;

  let sqDiffSum = 0;
  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (typeof val !== "number" || isNaN(val)) continue;
    sqDiffSum += Math.pow(val - mean, 2);
  }

  const stdev = Math.sqrt(sqDiffSum / count);

  // Mise à jour du DOM
  document.getElementById("stat-min").textContent   = `${formatNumber(min)} ${unit}`;
  document.getElementById("stat-max").textContent   = `${formatNumber(max)} ${unit}`;
  document.getElementById("stat-mean").textContent  = `${formatNumber(mean)} ${unit}`;
  document.getElementById("stat-stdev").textContent = `${formatNumber(stdev)} ${unit}`;
}

document.getElementById("decimals").addEventListener("input", (e) => {
  decimals = parseInt(e.target.value) || 2;
  updateStats(lastData);
});

document.getElementById("notation").addEventListener("change", (e) => {
  useExponential = (e.target.value === "exp");
  updateStats(lastData);
});


function formatNumber(val) {
  if (!Number.isFinite(val)) return "—";

  if (useExponential) {
    return val.toExponential(decimals);
  } else {
    return val.toFixed(decimals);
  }
}

/**
 * Réinitialise les statistiques affichées.
 */
export function clearStats() {
  document.getElementById('stat-min').textContent = '——';
  document.getElementById('stat-max').textContent = '——';
  document.getElementById('stat-mean').textContent = '——';
  document.getElementById('stat-stdev').textContent = '——';
}