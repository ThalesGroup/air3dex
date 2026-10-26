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

import { clearCharts, initAllCharts } from './chartAnalyzer.js';
import { clearStats, updateStats } from './dataStats.js';
import { clearSummary, updateSummary } from './dataSummary.js';
import { setCurrentData, updateLegend } from './legendUpdater.js';
import { addBoundingBoxToMinimap, clearBoundingBox } from './minimap.js';
import { getColorForValue, resetScale } from './scaleModes.js';
import { applyTransparency, setAlphaPercent } from "./transparency.js";


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
  const jsonDs = new Cesium.CustomDataSource("Couche JSON");

  const positions = data.positions;
  const values = data.values;
  const units = data.units;
  let alphaPercent = parseInt(document.getElementById("alpha-slider")?.value || 85);
  let alpha = Math.round((alphaPercent / 100) * 255);

  // --- Timestamps: accepte array ISO OU {start, step_seconds, count}
  const ts = data.timestamps;
  let startJD, stepSec, count;
  let timeDates = [];

  if (Array.isArray(ts)) {
    startJD = Cesium.JulianDate.fromIso8601(ts[0]);
    stepSec =
      ts.length > 1
        ? Cesium.JulianDate.secondsDifference(
            Cesium.JulianDate.fromIso8601(ts[1]),
            startJD
          )
        : 0;
    count = ts.length;
    timeDates = ts.map(s => Cesium.JulianDate.fromIso8601(s));
  } else {
    startJD = Cesium.JulianDate.fromIso8601(ts.start);
    stepSec = ts.step_seconds;
    count = ts.count;
    for (let i = 0; i < count; i++) {
      timeDates.push(
        Cesium.JulianDate.addSeconds(startJD, i * stepSec, new Cesium.JulianDate())
      );
    }
  }

  const stopJD = Cesium.JulianDate.addSeconds(
    startJD,
    stepSec * (count - 1),
    new Cesium.JulianDate()
  );

  // --- Horloge Cesium
  viewer.clock.startTime = startJD.clone();
  viewer.clock.stopTime = stopJD.clone();
  viewer.clock.currentTime = startJD.clone();
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  viewer.clock.multiplier = 27000;
  viewer.timeline.zoomTo(startJD, stopJD);

  // --- Crée la collection de points
  const pointCollection = new Cesium.PointPrimitiveCollection();
  const points = new Array(positions.length);

  // Index temporel courant (entier) pour éviter de re-colorer à chaque frame
  let lastTimeIndex = -1;

  // Valeurs arrondies (si besoin) et couleur initiale (index 0)
  const safeVal = (v) => (v == null || isNaN(v) ? 0 : Math.round(v * 1e6) / 1e6);

  for (let i = 0; i < positions.length; i++) {
    const [lon, lat, alt] = positions[i];
    const pos = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

    const v0 = safeVal(values[i][0]);
    //const c0 = Cesium.Color.fromAlpha(getColorForValue(v0), alpha / 255);

    const baseColor = getColorForValue(v0); // Cesium.Color
    const c0 = new Cesium.Color(baseColor.red, baseColor.green, baseColor.blue, alpha / 255);


    points[i] = pointCollection.add({
      position: pos,
      color: c0,
      pixelSize: 10
    });
  }

  function updateColors(idx) {
    applyTransparency(points, values, idx);
  }

  const onTick = () => {
    const secs = Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, startJD);
    let idx = Math.round(secs / (stepSec || 1));
    idx = Math.max(0, Math.min(count - 1, idx));
    if (idx === lastTimeIndex) return;
    lastTimeIndex = idx;
    updateColors(idx);
  };

  viewer.scene.primitives.add(pointCollection);
  viewer.clock.onTick.addEventListener(onTick);


  const transpSelect = document.getElementById("transp-mode");
  const alphaSlider = document.getElementById("alpha-slider");
  const alphaInput = document.getElementById("alpha-value");

  if (alphaSlider && alphaInput) {
    alphaSlider.addEventListener("input", () => {
      setAlphaPercent(parseInt(alphaSlider.value));
      alphaInput.value = alphaSlider.value;
    });

    alphaInput.addEventListener("input", () => {
      let val = parseInt(alphaInput.value);
      setAlphaPercent(val);
      alphaSlider.value = val;
    });
  }


  function updateTransparencyUI() {
    if (!transpSelect || !alphaSlider || !alphaInput) return;

    if (transpSelect.value === "dyn-transp") {
      alphaSlider.disabled = true;
      alphaInput.disabled = true;
    } else {
      alphaSlider.disabled = false;
      alphaInput.disabled = false;
    }
  }

  // Appliquer au changement
  if (transpSelect) {
    transpSelect.addEventListener("change", updateTransparencyUI);
    updateTransparencyUI(); // init
  }


  // --- Fournit des timestamps ISO (array) au panneau de droite
  const timestampsISO = timeDates.map(d => Cesium.JulianDate.toIso8601(d));
  const rawForUi = {...data, timestamps: timestampsISO};

  // --- UI (ajout, zoom, suppression)
  if (!skipUi) {
    addJsonLayerToList(viewer, jsonDs, () => {
        viewer.clock.onTick.removeEventListener(onTick);
        viewer.scene.primitives.remove(pointCollection, true);
      }, async () => {
        // Zoom sur tous les points
        if (positions.length > 0) {
          const cartesians = positions.map(p => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2]));
          const bs = Cesium.BoundingSphere.fromPoints(cartesians);
          viewer.camera.flyToBoundingSphere(bs, {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(0, -0.5, bs.radius * 2)
          });
        }
      }, filename, "json", minimap);

    if (positions.length > 0) {
      const cartesians = positions.map(p => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2]));
      const bs = Cesium.BoundingSphere.fromPoints(cartesians);
      viewer.camera.flyToBoundingSphere(bs, {
        duration: 1.5,
        offset: new Cesium.HeadingPitchRange(0, -0.5, bs.radius * 2)
      });
    }
  }

  // --- Expose les données brutes et positions
  jsonDs.values = values;
  jsonDs._rawData = rawForUi;   // <= timestamps en array ISO pour Résumé/Stats/Graphiques
  jsonDs.positions = positions;
  jsonDs.units = units;

  // Première coloration correcte (index 0)
  lastTimeIndex = -1;
  onTick();

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
  jsonDs.units = units;
  // jsonDs._pointsCollection = pointCollection; // pour pouvoir la supprimer plus tard

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

  // ----- helpers pour DataSource vs Primitive -----
  const gfx = dataSource._graphics || null;

  const containsDs = () =>
    viewer.dataSources && viewer.dataSources.contains && viewer.dataSources.contains(dataSource);

  const zoomFn = async () => {
    if (typeof zoomCallback === 'function') return zoomCallback(dataSource);
    if (dataSource._points) {
      const positions = dataSource._points.map(p => p.position);
      const bs = Cesium.BoundingSphere.fromPoints(positions);
      viewer.camera.flyToBoundingSphere(bs);
    }
  };

  const removeFn = () => {
    if (typeof removeCallback === 'function') removeCallback(dataSource);
    if (gfx?.remove) gfx.remove();
    if (containsDs()) viewer.dataSources.remove(dataSource, true);
  };

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
    await zoomFn();
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
    removeFn();
    li.remove();

    clearStats();
    clearCharts();
    resetScale();
    clearSummary();

    if (currentBoundingBox) {
        clearBoundingBox(minimap, currentBoundingBox);
        currentBoundingBox = null;
    }

    const layers = document.querySelectorAll('#data-list .list-group-item');
    const rightPanel = document.getElementById('right-panel');

    if (layers.length === 0) {
      // --- Nettoyage complet ---
      resetClock(viewer);
      clearStats();
      clearCharts();
      resetScale();
      clearSummary();
      updateLegend(null, null);
      setCurrentData(null, null);

      if (currentBoundingBox) {
        clearBoundingBox(minimap, currentBoundingBox);
        currentBoundingBox = null;
      }

      rightPanel.style.display = 'none';
      document.getElementById('min-value').textContent = '——';
      document.getElementById('max-value').textContent = '——';
    } else {
      // --- Mise à jour de l’horloge avec la couche active ---
      const activeLayer = document.querySelector('#data-list .list-group-item .eye-btn.active');
      if (activeLayer) {
        const activeLi = activeLayer.closest('.list-group-item');
        if (activeLi && activeLi._dataSource && activeLi._dataSource._rawData) {
          updateClock(viewer, activeLi._dataSource._rawData);
        }
      }

      // --- Si aucune couche active, on force la première restante ---
      if (!document.querySelector('.eye-btn.active')) {
        const firstEye = layers[0].querySelector('.eye-btn');
        if (firstEye) firstEye.click();
      }
    }
  });

  // === Bouton ISO / Points ===
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
    isoImg.src = isIsoEnabled ? '../static/assets/icons/iso-on.svg' : '../static/assets/icons/iso-off.svg';

    const wasActive = btnActive.classList.contains('active');

    // nettoie l'affichage courant (primitive ou datasource)
    removeFn();

    // recharge selon le mode
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

    if (wasActive) {
      activateLayer(li);
      updateAll(newDs);
    } else {
      // masque si non active
      if (newDs._graphics?.setShow) newDs._graphics.setShow(false);
      if (containsDs()) newDs.show = false;
    }
  });

  function activateLayer(targetLi) {
    document.querySelectorAll('#data-list .list-group-item').forEach(layerLi => {
      const ds = layerLi._dataSource;
      const isActive = layerLi === targetLi;

      // Active / désactive le style visuel de la ligne
      layerLi.classList.toggle('disabled-layer', !isActive);

      // Gestion visibilité : toujours une seule couche visible
      if (ds._pointsCollection) {
        ds._pointsCollection.show = isActive;
      }
      if (ds._graphics?.setShow) {
        ds._graphics.setShow(isActive);
      }
      if (viewer.dataSources.contains(ds)) {
        ds.show = isActive;
      }

      // Met à jour le badge
      const badge = layerLi.querySelector('.status-badge');
      badge.classList.toggle('active', isActive);
      badge.style.backgroundColor = isActive ? '#28a745' : '#6c757d';
      badge.title = `Statut de la couche : ${isActive ? 'activée' : 'désactivée'}`;

      // Met à jour le logo de l'œil
      const eyeImg = layerLi.querySelector('.eye-btn img');
      if (eyeImg) {
        eyeImg.src = isActive
          ? '../static/assets/icons/eye-open.svg'
          : '../static/assets/icons/eye-close.svg';
      }

      // Met à jour la classe de l’œil
      const btnEye = layerLi.querySelector('.eye-btn');
      if (btnEye) {
        btnEye.classList.toggle('active', isActive);
      }
    });
  }


  function updateAll(ds) {
    const raw = ds._rawData;
    const fmt = li._formatType;
    updateStats(ds);
    updateSummary(raw, fmt);
    updateLegend(ds, fmt);
    setCurrentData(ds, fmt);
    console.log("Appel updateSummary avec :", ds, fmt, li._renderType);
    initAllCharts(raw);
  }

  btnActive.addEventListener('click', async () => {
    activateLayer(li);
    await zoomFn();
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

  // État interne
  li._dataSources = [dataSource];
  li._dataSource = dataSource;
  li._formatType = formatType; // 'json' ou 'czml'
  li._renderType = 'points';
  dataSource._rawData = dataSource._rawData || null;

  activateLayer(li);
  jsonList.appendChild(li);
}

// --- Supporte array OU timestamps compressés {start, step_seconds, count}
function updateClock(viewer, data) {
  const t = data.timestamps;
  let start, stop;
  if (Array.isArray(t)) {
    const timeDates = t.map(x => Cesium.JulianDate.fromIso8601(x));
    start = timeDates[0];
    stop = timeDates[timeDates.length - 1];
  } else {
    const startJD = Cesium.JulianDate.fromIso8601(t.start);
    const stopJD = Cesium.JulianDate.addSeconds(startJD, (t.count - 1) * t.step_seconds, new Cesium.JulianDate());
    start = startJD; stop = stopJD;
  }

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
