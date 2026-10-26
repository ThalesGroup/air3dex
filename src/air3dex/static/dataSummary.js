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
 * @file dataSummary.js
 * @description Résume les métadonnées des fichiers de données (type, variable, durée, pas de temps,
 * seuil, nombre d'entités) et les affiche dynamiquement dans l'interface.
 */

import { setCurrentVariable } from './scaleModes.js';

/**
 * Convertit un nom de variable brute en nom plus lisible.
 * @param {string} rawVar - Nom brut de la variable.
 * @returns {string} Nom lisible ou original si non trouvé.
 */
function varToIndexName(rawVar) {
  const map = {
    "pm10_conc": "PM10",
    "pm2p5_conc": "PM2.5",
    "pmwf_conc": "PM10 (Feux)",
    "dust": "Dust (une fraction des PM10)",
    "no2_conc": "NO₂",
    "o3_conc": "O₃",
    "co_conc": "CO"
  };
  return map[rawVar] || rawVar || "—";
}

/**
 * Met à jour le résumé des données affiché dans le DOM.
 * Supporte deux types de données : 'czml' (Cesium) et 'json'.
 *
 * @param {Object} data - Données à résumer.
 * @param {string} type - Type de données ('czml' ou 'json').
 */
export function updateSummary(data, type) {
  if (!data) return;

  const dataSummary = document.getElementById("data-summary");

  let startTimeIso, stopTimeIso, variable = "—", seuil = "—", nbEntities = 0;
  let durationStr = "—", timeStepStr = "—", visType = "—";

  if (type === 'czml') {
    const entities = data.entities.values;
    if (!entities.length) return;

    startTimeIso = Cesium.JulianDate.toIso8601(data.clock.startTime);
    stopTimeIso = Cesium.JulianDate.toIso8601(data.clock.stopTime);

    // Calcul durée acquisition
    const startDate = new Date(startTimeIso);
    const endDate = new Date(stopTimeIso);

    if (!isNaN(startDate) && !isNaN(endDate)) {
      const durationMs = endDate - startDate;
      const durationDays = durationMs / (1000 * 60 * 60 * 24);
      const durationHours = durationMs / (1000 * 60 * 60);
      const durationMinutes = durationMs / (1000 * 60);

      if (durationDays >= 1) durationStr = `${durationDays.toFixed(0)} jour(s)`;
      else if (durationHours >= 1) durationStr = `${durationHours.toFixed(0)} heure(s)`;
      else durationStr = `${durationMinutes.toFixed(2)} minutes`;
    }

    // Variable : préfixe avant premier '-'
    variable = varToIndexName(entities[0].id.split("-")[0]) || "inconnue";

    // Seuil : minimum extrait des valeurs dans les noms
    const values = entities.map(e => {
      const match = e.name.match(/([\d.]+)/);
      return match ? parseFloat(match[1]) : null;
    }).filter(v => v !== null);

    seuil = values.length ? Math.min(...values).toFixed(2) : "—";

    // Unité extraite du nom d'un échantillon
    const nameSample = entities.find(e => e.name)?.name ?? "";
    const unitMatch = nameSample.match(/[\d.]+\s*(.*)/);
    const unit = unitMatch ? unitMatch[1].replace("m3", "m³") : "";

    // 3D ou 2D
    const is3D = entities.some(e => e.ellipsoid !== undefined);
    visType = is3D ? "CZML 3D (ellipsoïdes)" : "CZML 2D (points)";

    nbEntities = entities.length;

    // Calcul pas de temps moyen
    const timeSteps = [];

    entities.forEach(e => {
      if (e.availability) {
        const interval = e.availability.get(0);
        if (interval) {
          const s = Cesium.JulianDate.toDate(interval.start);
          const e_ = Cesium.JulianDate.toDate(interval.stop);
          const diff = e_ - s;
          if (!isNaN(diff) && diff > 0) timeSteps.push(diff);
        }
      }
    });

    if (timeSteps.length) {
      const meanStepMs = timeSteps.reduce((a,b) => a+b, 0) / timeSteps.length;
      if (meanStepMs >= 3600*1000) timeStepStr = `${(meanStepMs / 3600000).toFixed(0)} heure(s)`;
      else if (meanStepMs >= 60*1000) timeStepStr = `${(meanStepMs / 60000).toFixed(0)} minutes`;
      else timeStepStr = `${(meanStepMs / 1000).toFixed(0)} secondes`;
    }

    // Ajoute unité au seuil
    seuil = seuil === "—" ? seuil : seuil + " " + unit;



  } else if (type === 'json') {
    if (!data.timestamps) return;

    startTimeIso = data.timestamps[0] || "—";
    stopTimeIso = data.timestamps[data.timestamps.length - 1] || "—";

    const startDate = new Date(startTimeIso);
    const endDate = new Date(stopTimeIso);
    const durationMs = endDate.getTime() - startDate.getTime();

    if (!isNaN(durationMs)) {
      const durationDays = durationMs / (1000 * 60 * 60 * 24);
      durationStr = durationDays >= 1
        ? `${durationDays.toFixed(0)} jours`
        : `${(durationMs / (1000 * 60 * 60)).toFixed(0)} heure(s)`;
    }

    if (data.timestamps.length > 1) {
      const diffs = [];
      for (let i=1; i<data.timestamps.length; i++) {
        const t1 = new Date(data.timestamps[i-1]).getTime();
        const t2 = new Date(data.timestamps[i]).getTime();
        if (!isNaN(t1) && !isNaN(t2)) diffs.push(t2 - t1);
      }
      if (diffs.length) {
        const avgStepMs = diffs.reduce((a,b)=>a+b,0)/diffs.length;
        if (avgStepMs >= 3600*1000) timeStepStr = `${(avgStepMs / 3600000).toFixed(0)} heure(s)`;
        else if (avgStepMs >= 60*1000) timeStepStr = `${(avgStepMs / 60000).toFixed(0)} minutes`;
        else timeStepStr = `${(avgStepMs / 1000).toFixed(0)} secondes`;
      }
    }

    variable = data.variable !== undefined ? varToIndexName(data.variable) : "—";
    setCurrentVariable(variable);

    //const unit = "µg/m³";
    //seuil = data.seuil !== undefined ? parseFloat(data.seuil).toFixed(2) + (unit ? " " + unit : "") : "—";

    nbEntities = data.positions ? data.positions.length : 0;
    visType = "JSON";


  } else {
    console.warn("Type de données inconnu pour updateSummary");
    return;
  }

  // Format affichage dates
  const startTime = startTimeIso.replace('T', ' ').replace('Z', '');
  const stopTime = stopTimeIso.replace('T', ' ').replace('Z', '');

  // Affichage résumé
  dataSummary.innerHTML = `
    <ul class="list-group list-group-flush small">
      <li class="list-group-item"><strong>Début :</strong> ${startTime}</li>
      <li class="list-group-item"><strong>Fin :</strong> ${stopTime}</li>
      <li class="list-group-item"><strong>Durée :</strong> ${durationStr}</li>
      <li class="list-group-item"><strong>Pas de temps :</strong> ${timeStepStr}</li>
      <li class="list-group-item"><strong>Variable :</strong> ${variable}</li>
      <li class="list-group-item"><strong>Visualisation :</strong> ${visType}</li>
      <li class="list-group-item"><strong>Nombre d'entités :</strong> ${nbEntities}</li>
    </ul>
  `;
}

/**
 * Vide le résumé des données affiché dans le DOM.
 */
export function clearSummary() {
  const dataSummary = document.getElementById("data-summary");
  if (dataSummary) {
    dataSummary.innerHTML = "";
  }
}
