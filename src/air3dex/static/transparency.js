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

// transparency.js
import { getColorForValue, getCurrentScaleBounds } from "./scaleModes.js";

let alphaPercent = 85; // valeur par défaut (manuel)

// Slider = met à jour alpha manuel
export function setAlphaPercent(percent) {
  alphaPercent = Math.max(0, Math.min(100, percent));
}

export function applyTransparency(points, values, idx) {
  const transpMode = document.getElementById("transp-mode")?.value || "manual-transp";

  for (let i = 0; i < points.length; i++) {
    const v = values[i][idx];
    let color;

    if (transpMode === "manual-transp") {
      const alpha = alphaPercent / 100;
      color = getColorForValue(v).withAlpha(alpha);

    } else if (transpMode === "dyn-transp") {
      const [minVal, maxVal] = getCurrentScaleBounds();

      let norm = 1;
      if (maxVal !== minVal) norm = (v - minVal) / (maxVal - minVal);
      norm = Math.max(0, Math.min(1, norm));
      
      color = getColorForValue(v).withAlpha(norm);
    }

    points[i].color = color;
  }
}

/*
export function applyTransparency(points, values, idx) {
  const transpMode = document.getElementById("transp-mode")?.value || "manual-transp";

  for (let i = 0; i < points.length; i++) {
    const v = values[i][idx];

    // Ignorer les valeurs nulles ou zéro
    if (v == null || v === 0) {
      points[i].show = false; // optionnel, cache le point dans Cesium
      continue;
    } else {
      points[i].show = true;
    }

    let alpha;

    if (transpMode === "manual-transp") {
      alpha = alphaPercent / 100;
    } else if (transpMode === "dyn-transp") {
      const [minVal, maxVal] = getCurrentScaleBounds();
      let norm = 1;
      if (maxVal !== minVal) norm = (v - minVal) / (maxVal - minVal);
      norm = Math.max(0, Math.min(1, norm));
      alpha = norm;
    }

    const baseColor = getColorForValue(v); // Cesium.Color
    const color = new Cesium.Color(
      baseColor.red,
      baseColor.green,
      baseColor.blue,
      alpha
    );

    points[i].color = color;
  }
}
*/