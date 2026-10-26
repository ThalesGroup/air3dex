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

let currentBoundingBox = null; // variable pour stocker le rectangle actuel

/**
 * Ajoute un rectangle rouge sur la minimap Leaflet pour représenter
 * l'emprise minimale des positions données.
 * 
 * @param {L.Map} minimap - La minimap Leaflet.
 * @param {Array} positions - Tableau des positions [lon, lat, alt].
 * @returns {L.Rectangle} L'entité Leaflet rectangle ajoutée.
 */
export function addBoundingBoxToMinimap(minimap, positions) {
  if (!positions || positions.length === 0) return null;

  // Supprimer le rectangle existant si besoin
  if (currentBoundingBox) {
    minimap.removeLayer(currentBoundingBox);
    currentBoundingBox = null;
  }

  const lats = positions.map(p => p[1]);
  const lons = positions.map(p => p[0]);

  function normalizeLon(lon) {
    let normalized = lon;
    while (normalized > 180) normalized -= 360;
    while (normalized < -180) normalized += 360;
    return normalized;
  }

  const normalizedLons = lons.map(normalizeLon);

  function getMin(arr) {
    let min = arr[0];
    for (let i = 1; i < arr.length; i++) if (arr[i] < min) min = arr[i];
    return min;
  }

  function getMax(arr) {
    let max = arr[0];
    for (let i = 1; i < arr.length; i++) if (arr[i] > max) max = arr[i];
    return max;
  }

  const south = getMin(lats);
  const north = getMax(lats);
  const west = getMin(normalizedLons);
  const east = getMax(normalizedLons);

  const bounds = [
    [south, west],
    [north, east]
  ];

  currentBoundingBox = L.rectangle(bounds, {
    color: "red",
    weight: 2,
    fillOpacity: 0.1
  }).addTo(minimap);

  minimap.fitBounds(bounds);

  return currentBoundingBox;
}

/**
 * Supprime un rectangle Leaflet de la minimap.
 * 
 * @param {L.Map} minimap - La minimap Leaflet.
 * @param {L.Rectangle|null} currentBoundingBox - Le rectangle à supprimer.
 */
export function clearBoundingBox(minimap, currentBoundingBox) {
  if (currentBoundingBox) {
    minimap.removeLayer(currentBoundingBox);
    currentBoundingBox = null;
  }
}