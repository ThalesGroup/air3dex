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
 * @file dataFormHandler.js
 * @description Gère le formulaire de chargement de fichiers (CZML ou JSON), déclenche le traitement,
 * l'affichage, les stats, les graphes et la mise à jour de l'interface.
 */

import { setCurrentData, refreshLegend, updateLegend } from './legendUpdater.js';
import { updateSummary } from './dataSummary.js';
import { initAllCharts } from './chartAnalyzer.js' ;
import { updateStats } from './dataStats.js';
//import { setupIsoViewToggle } from './isoViewToggle.js';
import { loadJsonData } from './loadJsonDataOpti.js';
import { loadCzmlData } from './loadCzmlData.js';
import { addBoundingBoxToMinimap } from './minimap.js';

/**
 * Fonction principale qui gère le formulaire de chargement de données (CZML ou JSON)
 * @param {Cesium.Viewer} viewer - Instance du viewer Cesium utilisée pour l'affichage des données.
 */
export function handleDataForm(viewer, minimap) {
  // Récupération des éléments HTML du formulaire et de l'interface
  const form          = document.getElementById('data-form');
  const fileInput     = document.getElementById('data-file');
  const spinnerBtn    = document.getElementById('loading-spinner-btn');
  const submitBtn     = document.getElementById('submit-btn');
  const rightPanel    = document.getElementById('right-panel');
  const loadTime      = document.getElementById('loadTime');
  const scaleOptions  = document.getElementById("scale-options");

  // Ajout d’un écouteur d’événement sur la soumission du formulaire
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Ajout de son propre token pour accéder à Ceisum et initialise un nouveau viewer
    /*const tokenInput = document.getElementById('cesium-token').value;
    if (!tokenInput) {
      alert("Veuillez saisir un token Cesium.");
      return;
    }
    const viewer = initViewer(tokenInput);
    initScaleControls(viewer)
    monitorPerformance(viewer)*/

    const file = fileInput.files[0];
    if (!file) return alert('Veuillez sélectionner un fichier.');

    // Détection automatique du type à partir de l'extension
    const extension = file.name.split('.').pop().toLowerCase();

    const supportedTypes = ['czml', 'json'];
    if (!supportedTypes.includes(extension)) {
      return alert(`Type de fichier non supporté : .${extension}`);
    }

    // Affichage d’un spinner pendant le chargement
    submitBtn.style.display = 'none';
    spinnerBtn.style.display = 'inline-block';

    try {
      const start = performance.now();
      const blobUrl = URL.createObjectURL(file);

      if (extension == 'czml') {
        // --- Traitement d’un fichier CZML ---
        const { czmlDs, czmlExtracted } = await loadCzmlData(viewer, blobUrl, file.name);

        loadTime.textContent = `Load ${((performance.now() - start) / 1000).toFixed(2)} s`;
        scaleOptions.style.display = "block";

        setCurrentData(czmlDs, 'czml');
        updateLegend(czmlDs, 'czml');
        updateSummary(czmlDs, 'czml');

        updateStats(czmlExtracted);
        initAllCharts(czmlExtracted);

      } else if (extension == 'json') {
        // --- Traitement d’un fichier JSON Shader ---
        const response = await fetch(blobUrl);
        const jsonDs = await response.json();
        const jsonDataSource = await loadJsonData(viewer, jsonDs, file.name, minimap);

        addBoundingBoxToMinimap(minimap, jsonDataSource.positions);

        loadTime.textContent = `Load ${((performance.now() - start) / 1000).toFixed(2)} s`;
        scaleOptions.style.display = "block";

        setCurrentData(jsonDataSource, 'json');
        refreshLegend(viewer);

        updateSummary(jsonDataSource._rawData, 'json');
        updateStats(jsonDataSource);
        //setupIsoViewToggle(jsonDataSource);
        initAllCharts(jsonDataSource._rawData);
      }

      // Affiche le panneau latéral avec les infos
      rightPanel.style.display = 'block';

      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      // Réinitialisation de l'interface après le chargement
      spinnerBtn.style.display = 'none';
      submitBtn.style.display = 'inline-block';
      form.reset();
    }
  });
}
