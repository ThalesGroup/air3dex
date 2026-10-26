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
 * @file loadCzmlData.js
 * @description Chargement et gestion d'une source CZML dans Cesium avec ajout dynamique de la couche
 * à la liste UI, application de coloration selon les valeurs, extraction des données pour les stats
 * et réinitialisation des états.
 */

import { resetScale, getColorForValue } from './scaleModes.js';
import { clearStats } from './dataStats.js';
import { clearCharts } from './chartAnalyzer.js';

/**
 * Charge un fichier CZML depuis une URL (blob ou autre),
 * ajoute la source au viewer, applique coloration dynamique,
 * ajoute la couche à la liste, extrait les données utiles.
 *
 * @param {Cesium.Viewer} viewer - Instance du viewer Cesium.
 * @param {string} czmlUrl - URL du fichier CZML à charger.
 * @param {string} filename - Nom affiché pour la couche.
 * @returns {Promise<Cesium.CzmlDataSource>} La couche CZML chargée.
 */
export async function loadCzmlData(viewer, url, filename) {
  // Charge la source CZML
  const czmlDs = await Cesium.CzmlDataSource.load(url, {
    sourceUri: filename || 'Couche CZML'
  });

  viewer.dataSources.add(czmlDs);
  await viewer.zoomTo(czmlDs);

  applyDynamicColoringToCzml(czmlDs);
  addCzmlLayerToList(viewer, czmlDs);

  const czmlExtracted = extractDataFromCzml(czmlDs);
  resetScale();
  clearStats();

  return { czmlDs, czmlExtracted };
}

/**
 * Ajoute une couche CZML à la liste affichée dans l'interface utilisateur,
 * avec des boutons pour zoomer et supprimer la couche.
 *
 * @param {Cesium.Viewer} viewer - L’instance du viewer Cesium.
 * @param {Cesium.DataSource} dataSource - La source de données CZML à gérer.
 */
function addCzmlLayerToList(viewer, dataSource) {
  const czmlList = document.getElementById('data-list');
  const li = document.createElement('li');
  li.className = 'list-group-item';

  const title = document.createElement('div');
  title.className = 'fw-bold';
  title.textContent = dataSource.name || 'Couche CZML';
  li.appendChild(title);

  const btnContainer = document.createElement('div');
  btnContainer.className = 'mt-2 d-flex gap-2';

  // Bouton de suppression de la couche
  const btnRemove = document.createElement('button');
  btnRemove.className = 'btn btn-sm btn-danger';
  btnRemove.textContent = 'Supprimer';
  btnRemove.addEventListener('click', () => {
    viewer.dataSources.remove(dataSource, true);
    li.remove();
    document.getElementById('min-value').textContent = '——';
    document.getElementById('max-value').textContent = '——';
    document.getElementById("data-summary").innerHTML = '';
    document.getElementById("right-panel").style.display = "none";
    document.getElementById("scale-options").style.display = "none";
    resetScale();
    clearStats();
    clearCharts();
  });

  // Bouton pour zoomer sur la couche
  const btnZoom = document.createElement('button');
  btnZoom.className = 'btn btn-sm btn-info';
  btnZoom.textContent = 'Zoom';
  btnZoom.addEventListener('click', () => {
    viewer.zoomTo(dataSource);
  });

  btnContainer.appendChild(btnRemove);
  btnContainer.appendChild(btnZoom);
  li.appendChild(btnContainer);
  czmlList.appendChild(li);
}

function applyDynamicColoringToCzml(czmlDs) {
  const alpha = 200;

  czmlDs.entities.values.forEach(entity => {
    const valueProp = entity.properties?.value;
    if (valueProp) {
      const colorProperty = new Cesium.CallbackProperty((time) => {
        const value = valueProp.getValue(time);
        const color = getColorForValue(value);
        return Cesium.Color.fromAlpha(color, alpha / 255);
      }, false);

      if (entity.point) {
        entity.point.color = colorProperty;
      } else if (entity.ellipsoid) {
        entity.ellipsoid.material = new Cesium.ColorMaterialProperty(colorProperty);

        if (entity.availability) {
          entity.ellipsoid.show = new Cesium.CallbackProperty((time) => {
            return entity.availability.contains(time);
          }, false);
        }
      }
    }
  });
}


/**
 * Extrait des données statistiques et temporelles depuis un fichier CZML.
 * Retourne un format compatible avec les outils stats & graphiques.
 *
 * @param {Cesium.CzmlDataSource} dataSource
 * @returns {Object} - { values: number[][], timestamps: string[], unit: string, variable: string }
 */
function extractDataFromCzml(dataSource) {
  const entities = dataSource.entities.values;
  const valuesByTime = {};
  const timestamps = new Set();
  let unit = '';
  let variable = '';

  entities.forEach(ent => {
    if (!Cesium.defined(ent.properties?.value)) return;

    const value = ent.properties.value.getValue(Cesium.JulianDate.now());
    if (isNaN(value)) return;

    // Extrait le timestamp à partir de l’"availability"
    const interval = ent.availability;
    if (!interval) return;

    const isoTime = interval.start.toString().split("T")[0] + "T" + interval.start.toString().split("T")[1].split("Z")[0] + "Z";
    timestamps.add(isoTime);

    if (!valuesByTime[isoTime]) valuesByTime[isoTime] = [];
    valuesByTime[isoTime].push(value);

    // Essaye de retrouver l’unité depuis le nom
    if (!unit && ent.name) {
      const match = ent.name.match(/([\d.]+)\s*([^\s]+)/);
      if (match) unit = match[2];
    }

    if (!variable && ent.id.includes('-')) {
      variable = ent.id.split('-')[0];
    }
  });

  const sortedTimes = Array.from(timestamps).sort();
  const values = sortedTimes.map(t => valuesByTime[t] || []);

  return {
    timestamps: sortedTimes,
    values,
    unit: unit.replace('m3', 'm³'),
    variable
  };
}
