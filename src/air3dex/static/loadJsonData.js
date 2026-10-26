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
 * @file loadJsonData.js
 * @description Chargement et gestion d'une source JSON dans Cesium avec ajout dynamique de la couche
 * à la liste UI, application de coloration selon les valeurs, extraction des données pour les stats 
 * et réinitialisation des états.
 */

import { resetScale, getColorForValue } from './scaleModes.js';
import { updateStats, clearStats } from './dataStats.js';
import { initAllCharts, clearCharts } from './chartAnalyzer.js';
import { updateSummary, clearSummary } from './dataSummary.js';
import { updateLegend, setCurrentData } from './legendUpdater.js';
import { addBoundingBoxToMinimap, clearBoundingBox } from './minimap.js';

/**
 * Charge des données JSON et les affiche dans Cesium avec une mise 
 * à jour dynamique des couleurs selon les valeurs temporelles.
 * 
 * @param {Cesium.Viewer} viewer - Instance du viewer Cesium.
 * @param {Object} data - Données JSON contenant positions, valeurs, timestamps, noms.
 * @param {string} filename - Nom du fichier de données (utilisé pour la gestion de la couche).
 * @returns {Promise<Cesium.CustomDataSource>} La couche de données Cesium créée.
 */
export async function loadJsonData(viewer, data, filename, minimap, skipUi = false) {
  const jsonDs = new Cesium.CustomDataSource('Couche JSON');

  const positions = data.positions;
  const values = data.values;
  const timestamps = data.timestamps;
  const alpha = 200;

  const start = Cesium.JulianDate.fromIso8601(timestamps[0]);
  const stop = Cesium.JulianDate.fromIso8601(timestamps[timestamps.length - 1]);

  // Configure l’horloge du viewer Cesium pour jouer sur cette période en boucle
  viewer.clock.startTime = start.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = start.clone();
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  viewer.clock.multiplier = 27000;
  viewer.timeline.zoomTo(start, stop);

  // Configuration pour charger les données avec les couleurs pré-chargées
  /*
  const timeDates = timestamps.map(ts => Cesium.JulianDate.fromIso8601(ts));

  // Pour chaque position (point), crée une entité avec propriété temporelle
  for (let i = 0; i < positions.length; i++) {
    const [lon, lat, alt] = positions[i];
    const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

    const colorProperty = new Cesium.SampledProperty(Cesium.Color);

    // Remplir la propriété avec les couleurs pré-calculées
    for (let t = 0; t < timeDates.length; t++) {
      const value = values[i][t];
      const color = Cesium.Color.fromAlpha(getColorForValue(value), alpha / 255);
      colorProperty.addSample(timeDates[t], color);
    }

    const name = data.names?.[i]?.[0] || `Point ${i}`;

    // Créer l’entité avec couleur temporelle via SampledProperty (sans CallbackProperty)
    jsonDs.entities.add({
      name: name,
      position: position,
      point: {
        pixelSize: 10,
        color: colorProperty // directement la propriété temporelle de couleur
      }
    });

  }*/

  

  // Pour chaque position (point), crée une entité avec propriété temporelle
  for (let i = 0; i < positions.length; i++) {
    const [lon, lat, alt] = positions[i];
    const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

    const property = new Cesium.SampledProperty(Number); // Propriété échantillonnée pour stocker la valeur en fonction du temps

    // Ajoute les valeurs pour chaque timestamp dans la propriété temporelle
    for (let t = 0; t < timestamps.length; t++) {
      const time = Cesium.JulianDate.fromIso8601(timestamps[t]);
      property.addSample(time, values[i][t]);
    }

    // Propriété callback qui renvoie la couleur adaptée à la valeur au temps donné
    const colorProperty = new Cesium.CallbackProperty((time) => {
      const value = property.getValue(time);
      const color = getColorForValue(value);
      return Cesium.Color.fromAlpha(color, alpha / 255);
    }, false);

    const name = data.names?.[i]?.[0] || `Point ${i}`;

    // Ajoute l’entité point avec couleur dynamique à la couche
    jsonDs.entities.add({
      name: name,
      position: position,
      point: {
        pixelSize: 10,
        color: colorProperty
      }
    });
  }

  if (positions.length >= 2) {
    const distancesX = [];
    const distancesY = [];

    for (let i = 0; i < positions.length - 1; i++) {
      const [lon1, lat1] = positions[i];
      const [lon2, lat2] = positions[i + 1];

      // On suppose que les points sont organisés par lignes/colonnes (ex: grille)
      const dLon = Math.abs(lon2 - lon1);
      const dLat = Math.abs(lat2 - lat1);

      // Distance en mètres en X (longitude) et Y (latitude)
      const carto1 = Cesium.Cartographic.fromDegrees(lon1, lat1);
      const carto2x = Cesium.Cartographic.fromDegrees(lon2, lat1); // même Y pour calcul X
      const carto2y = Cesium.Cartographic.fromDegrees(lon1, lat2); // même X pour calcul Y

      const pos1 = Cesium.Ellipsoid.WGS84.cartographicToCartesian(carto1);
      const pos2x = Cesium.Ellipsoid.WGS84.cartographicToCartesian(carto2x);
      const pos2y = Cesium.Ellipsoid.WGS84.cartographicToCartesian(carto2y);

      if (dLon > 0) distancesX.push(Cesium.Cartesian3.distance(pos1, pos2x));
      if (dLat > 0) distancesY.push(Cesium.Cartesian3.distance(pos1, pos2y));
    }

    const meanX = distancesX.length ? (distancesX.reduce((a, b) => a + b, 0) / distancesX.length).toFixed(1) : "—";
    const meanY = distancesY.length ? (distancesY.reduce((a, b) => a + b, 0) / distancesY.length).toFixed(1) : "—";

    console.log(`Résolution moyenne : X = ${meanX} m, Y = ${meanY} m`);
    jsonDs.resolutionX = meanX;
    jsonDs.resolutionY = meanY;
  }

  viewer.dataSources.add(jsonDs);
  await viewer.zoomTo(jsonDs);

  if (!skipUi) {
    addJsonLayerToList(viewer, jsonDs, () => {
      viewer.dataSources.remove(jsonDs, true);
    }, async (ds) => {
      await viewer.zoomTo(ds.entities.values);
    }, filename, 'json', minimap);
  }

  jsonDs.values = values;
  jsonDs._rawData = data;
  jsonDs.positions = data.positions;

  return jsonDs;
}

/**
 * Affiche des surfaces triangulées dynamiques dans Cesium à partir de données JSON.
 * Pour chaque altitude, les points sont triangulés en 2D, puis chaque triangle est
 * coloré dynamiquement selon la moyenne des valeurs temporelles de ses sommets.
 * 
 * @param {Cesium.Viewer} viewer - Le viewer Cesium.
 * @param {Object} data - Données avec positions, valeurs temporelles et timestamps.
 * @param {string} filename - Nom du fichier source pour l’interface.
 * @param {boolean} [skipUi=false] - Si vrai, n’ajoute pas la couche à l’interface.
 * @returns {Promise<Cesium.CustomDataSource>} - La datasource créée.
 */
export async function loadJsonDataIso(viewer, data, filename, minimap, skipUi = false) {
  const jsonDs = new Cesium.CustomDataSource('Couche Iso-Surfaces');

  const positions = data.positions;
  const values = data.values;
  const timestamps = data.timestamps;
  const alpha = 200;

  const timeDates = timestamps.map(t => Cesium.JulianDate.fromIso8601(t));
  const start = timeDates[0];
  const stop = timeDates[timeDates.length - 1];

  viewer.clock.startTime = start.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = start.clone();
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  viewer.clock.multiplier = 27000;
  viewer.timeline.zoomTo(start, stop);

  // Regrouper les points par altitude
  const layers = {};
  for (let i = 0; i < positions.length; i++) {
    const altitude = positions[i][2].toFixed(2);
    if (!layers[altitude]) layers[altitude] = [];
    layers[altitude].push(i);
  }

  for (const altitude in layers) {
    const indices = layers[altitude];
    const points2D = indices.map(i => [positions[i][0], positions[i][1]]);

    // Utilisation de d3.Delaunay dans le scope global
    const delaunay = d3.Delaunay.from(points2D);
    const triangles = delaunay.triangles;

    for (let t = 0; t < triangles.length; t += 3) {
      const ia = indices[triangles[t]];
      const ib = indices[triangles[t + 1]];
      const ic = indices[triangles[t + 2]];

      const posA = Cesium.Cartesian3.fromDegrees(
        positions[ia][0],
        positions[ia][1],
        positions[ia][2]
      );
      const posB = Cesium.Cartesian3.fromDegrees(
        positions[ib][0],
        positions[ib][1],
        positions[ib][2]
      );
      const posC = Cesium.Cartesian3.fromDegrees(
        positions[ic][0],
        positions[ic][1],
        positions[ic][2]
      );

      const propA = new Cesium.SampledProperty(Number);
      const propB = new Cesium.SampledProperty(Number);
      const propC = new Cesium.SampledProperty(Number);

      for (let timeIndex = 0; timeIndex < timeDates.length; timeIndex++) {
        const time = timeDates[timeIndex];
        propA.addSample(time, values[ia][timeIndex]);
        propB.addSample(time, values[ib][timeIndex]);
        propC.addSample(time, values[ic][timeIndex]);
      }

      const polygonHierarchy = new Cesium.CallbackProperty(() => {
        return new Cesium.PolygonHierarchy([posA, posB, posC]);
      }, false);

      const dynamicColor = new Cesium.Color();

      const material = new Cesium.ColorMaterialProperty(
        new Cesium.CallbackProperty(function (time, result) {
          const vA = propA.getValue(time);
          const vB = propB.getValue(time);
          const vC = propC.getValue(time);

          if (vA == null || vB == null || vC == null) {
            return Cesium.Color.GRAY.withAlpha(alpha / 255);
          }

          const mean = (vA + vB + vC) / 3;
          const col = getColorForValue(mean);

          dynamicColor.red = col.red;
          dynamicColor.green = col.green;
          dynamicColor.blue = col.blue;
          dynamicColor.alpha = alpha / 255;
          return dynamicColor;
        }, false)
      );

      jsonDs.entities.add({
        polygon: {
          hierarchy: polygonHierarchy,
          material: material,
          perPositionHeight: true
        }
      });
    }
  }

  viewer.dataSources.add(jsonDs);
  await viewer.zoomTo(jsonDs);

  if (!skipUi) {
    addJsonLayerToList(viewer, jsonDs, () => {
      viewer.dataSources.remove(jsonDs, true);
    }, async (ds) => {
      await viewer.zoomTo(ds.entities.values);
    }, filename, 'iso', minimap);
  }

  jsonDs.values = values;
  jsonDs._rawData = data;

  return jsonDs;
}


let currentBoundingBox = null;

/** 
 * Ajoute une couche JSON à la liste affichée dans l’interface utilisateur,
 * avec gestion de la visibilité (checkbox), désactivation de l’interface,
 * et des boutons pour statistiques, zoom et suppression.
 *
 * @param {any} dataSource - Les données JSON associées, compatibles avec Cesium.
 * @param {Function} removeCallback - Fonction à appeler lors de la suppression de la couche.
 * @param {Function} zoomCallback - Fonction à appeler pour zoomer sur la couche.
 * @param {string} filename - Nom du fichier affiché comme titre dans l’interface.
 */
function addJsonLayerToList(viewer, dataSource, removeCallback, zoomCallback, filename, formatType, minimap) {
  const jsonList = document.getElementById('data-list');

  const li = document.createElement('li');
  li.className = 'list-group-item';

  const titleRow = document.createElement('div');
  titleRow.className = 'title-row';

  const layerInfo = document.createElement('div');
  layerInfo.className = 'layer-info';

  const badge = document.createElement('span');
  badge.className = 'status-badge active';
  badge.title = 'Statut de la couche : activée';

  const title = document.createElement('span');
  title.className = 'title-text fw-bold';
  title.style.whiteSpace = 'normal';
  title.textContent = filename || dataSource.name || 'Couche JSON';

  layerInfo.appendChild(badge);
  layerInfo.appendChild(title);
  titleRow.appendChild(layerInfo);

  const btnContainer = document.createElement('div');
  btnContainer.className = 'btn-container';

  // === Bouton œil ===
  const btnActive = document.createElement('button');
  btnActive.className = 'btn-icon eye-btn active';
  btnActive.title = 'Afficher la couche';

  const openEye = document.createElement('img');
  openEye.src = '../static/assets/icons/eye-open.svg';
  openEye.style.width = '25px';
  btnActive.appendChild(openEye);

  // === Bouton zoom ===
  const btnZoom = document.createElement('button');
  btnZoom.className = 'btn-icon';
  btnZoom.title = 'Zoomer sur la couche';

  const zoomImg = document.createElement('img');
  zoomImg.src = '../static/assets/icons/zoom.svg';
  zoomImg.alt = 'Zoom';
  zoomImg.style.width = '20px';
  btnZoom.appendChild(zoomImg);

  btnZoom.addEventListener('click', async () => {
    if (zoomCallback) await zoomCallback(li._dataSource);
  });

  // === Bouton supprimer ===
  const btnRemove = document.createElement('button');
  btnRemove.className = 'btn-icon';
  btnRemove.title = 'Supprimer la couche';

  const deleteImg = document.createElement('img');
  deleteImg.src = '../static/assets/icons/remove.svg';
  deleteImg.alt = 'Supprimer';
  deleteImg.style.width = '20px';
  btnRemove.appendChild(deleteImg);

  btnRemove.addEventListener('click', () => {
    li._dataSources.forEach(ds => viewer.dataSources.remove(ds, true));
    li.remove();
    clearStats();
    clearCharts();
    resetScale();
    clearSummary();
    clearBoundingBox(minimap, currentBoundingBox);
    resetClock(viewer);

    // Vérifier combien de couches il reste dans la liste
    const layers = document.querySelectorAll('#data-list .list-group-item');

    if (layers.length === 0) {
      // Plus aucune couche → reset la clock
      resetClock(viewer);

      const rightPanel = document.getElementById('right-panel');
      rightPanel.style.display = 'none';

      const legendMin = document.getElementById('min-value');
      const legendMax = document.getElementById('max-value');
      legendMin.textContent = "——";
      legendMax.textContent = "——";
    } else {
      // Encore des couches → garder la clock de la première couche active
      const activeLayer = document.querySelector('#data-list .list-group-item .eye-btn.active');
      if (activeLayer) {
        const activeLi = activeLayer.closest('.list-group-item');
        if (activeLi && activeLi._dataSource && activeLi._dataSource._rawData) {
          updateClock(viewer, activeLi._dataSource._rawData);
        }
      }
    }

    const remainingEyes = document.querySelectorAll('.eye-btn');
    if (remainingEyes.length > 0 && !document.querySelector('.eye-btn.active')) {
      remainingEyes[0].click();
    }
  });

  const btnIso = document.createElement('button');
  btnIso.className = 'btn-icon iso-btn';
  btnIso.title = "Afficher sous forme d'isosurfaces";

  const isoImg = document.createElement('img');
  isoImg.src = '../static/assets/icons/iso-off.svg';
  isoImg.alt = 'Isosurfaces';
  isoImg.style.width = '25px';
  btnIso.appendChild(isoImg);

  let isIsoEnabled = false;

  btnIso.addEventListener('click', async () => {
    isIsoEnabled = !isIsoEnabled;

    // MAJ icône
    isoImg.src = isIsoEnabled ? '../static/assets/icons/iso-on.svg' : '../static/assets/icons/iso-off.svg';

    const wasActive = btnActive.classList.contains('active');

    li._dataSources.forEach(ds => {
      if (ds && viewer.dataSources.contains(ds)) {
        viewer.dataSources.remove(ds, true);
      }
    });

    let newDs;
    if (isIsoEnabled) {
      newDs = await loadJsonDataIso(viewer, li._dataSource._rawData, filename, minimap, true);
      li._renderType = 'iso';
    } else {
      newDs = await loadJsonData(viewer, li._dataSource._rawData, filename, minimap, true);
      li._renderType = 'points';
    }

    newDs._rawData = li._dataSource._rawData;
    li._dataSource = newDs;
    li._dataSources.push(newDs);

    if (wasActive) {
      activateLayer();
      updateAll(newDs);
    } else {
      newDs.show = false;
    }
  });

  function activateLayer() {
    openEye.src = '../static/assets/icons/eye-open.svg';

    document.querySelectorAll('.eye-btn').forEach(btn => {
      const img = btn.querySelector('img');
      if (btn !== btnActive) img.src = '../static/assets/icons/eye-close.svg';
      btn.classList.remove('active');
    });

    document.querySelectorAll('#data-list .list-group-item').forEach(layerLi => {
      const otherBadge = layerLi.querySelector('.status-badge');
      const isThis = layerLi === li;

      layerLi.classList.toggle('disabled-layer', !isThis);
      layerLi._dataSource.show = isThis;

      otherBadge.classList.toggle('active', isThis);
      otherBadge.style.backgroundColor = isThis ? '#28a745' : '#6c757d';
      otherBadge.title = `Statut de la couche : ${isThis ? 'activée' : 'désactivée'}`;
    });

    btnActive.classList.add('active');
  }

  function updateAll(ds) {
    const raw = ds._rawData;
    const fmt = li._formatType;
    updateStats(ds);
    updateSummary(raw, fmt);  // raw = JSON brut, fmt = 'json' ou 'czml'
    updateLegend(ds, fmt);
    setCurrentData(ds, fmt);
    console.log("Appel updateSummary avec :", ds, fmt, li._renderType);
    initAllCharts(raw);
  }

  btnActive.addEventListener('click', () => {
    activateLayer();
    updateAll(li._dataSource);
    updateClock(viewer, li._dataSource._rawData);

    const raw = li._dataSource._rawData;
    if (raw && raw.positions) {
      if (currentBoundingBox) {
        clearBoundingBox(minimap, currentBoundingBox);
        currentBoundingBox = null;
      }

      currentBoundingBox = addBoundingBoxToMinimap(minimap, raw.positions);
    }
  });

  btnContainer.appendChild(btnZoom);
  btnContainer.appendChild(btnIso);
  btnContainer.appendChild(btnActive);
  btnContainer.appendChild(btnRemove);

  li.appendChild(titleRow);
  li.appendChild(btnContainer);

  li._dataSources = [dataSource];
  li._dataSource = dataSource;
  li._formatType = formatType; // 'json' ou 'czml'
  li._renderType = 'points';   // par défaut
  dataSource._rawData = dataSource._rawData || null;

  activateLayer(); // active par défaut
  jsonList.appendChild(li);
}

function updateClock(viewer, data) {
  const timestamps = data.timestamps

  const timeDates = timestamps.map(t => Cesium.JulianDate.fromIso8601(t));
  const start = timeDates[0];
  const stop = timeDates[timeDates.length - 1];

  viewer.clock.startTime = start.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = start.clone();
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  viewer.clock.multiplier = 27000;
  viewer.timeline.zoomTo(start, stop);
}

function resetClock(viewer) {
  const today = Cesium.JulianDate.fromDate(new Date(new Date().setUTCHours(0, 0, 0, 0)));

  viewer.clock.startTime = today.clone();
  viewer.clock.stopTime = Cesium.JulianDate.addDays(today, 1, new Cesium.JulianDate());
  viewer.clock.currentTime = today.clone();
  viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
  viewer.clock.multiplier = 1;

  viewer.timeline.zoomTo(viewer.clock.startTime, viewer.clock.stopTime);
}
