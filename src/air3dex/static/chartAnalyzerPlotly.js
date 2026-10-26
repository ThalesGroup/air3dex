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
 * @file chartAnalyzerPlotly.js :
 * @description Gère la génération et l'affichage des visualisations statistiques (profil moyen, histogramme)
 * en utilisant Plotly.js.
 */

import { getColorForValue } from "./scaleModes.js";

function varToChart(rawVar) {
  const map = {
    "pm10_conc": "PM10",
    "pm2p5_conc": "PM2.5",
    "pmwf_conc": "PM10 (feux)",
    "no2_conc": "NO₂",
    "o3_conc": "O₃",
    "co_conc": "CO"
  };
  return map[rawVar] || rawVar || "—";
}

export function clearCharts() {
  const profileDiv = document.getElementById('canvas-profile');
  if (profileDiv) Plotly.purge(profileDiv);

  const histogramDiv = document.getElementById('canvas-histogram');
  if (histogramDiv) Plotly.purge(histogramDiv);

  // Pour heatmap, si jamais tu la rajoutes plus tard
  /*
  const heatmapDiv = document.getElementById('canvas-heatmap');
  if (heatmapDiv) Plotly.purge(heatmapDiv);
  */
}

/**
 * Affiche le profil moyen temporel sur le div 'canvas-profile'.
 */
export function createAverageProfileFeature(data) {
  const avgProfile = computeAverageProfile(data);
  setupAverageProfileChart(avgProfile, data.unit, data.variable);
}

/**
 * Calcule le profil moyen temporel.
 */
function computeAverageProfile(data) {
  const timestamps = data.timestamps;
  const nbTimes = timestamps.length;
  const nbPoints = data.values.length;

  const meanValues = new Array(nbTimes).fill(0);

  for (let t = 0; t < nbTimes; t++) {
    let sum = 0;
    for (let p = 0; p < nbPoints; p++) {
      sum += data.values[p][t];
    }
    meanValues[t] = sum / nbPoints;
  }

  return { timestamps, meanValues };
}

function setupAverageProfileChart(avgProfile, unit = 'µg/m³', variable = '') {
  const div = document.getElementById('canvas-profile');

  const values = avgProfile.meanValues;

  const labels = avgProfile.timestamps.map(t => {
    const date = new Date(t);
    const dayMonthYear = date.toLocaleDateString('fr-FR', { year: '2-digit', month: '2-digit', day: '2-digit' });
    const hour = date.getHours().toString().padStart(2, '0') + 'h';
    return `${dayMonthYear} ${hour}`;
  });

  // Pour Plotly, on ne peut pas directement colorer chaque segment d'une line facilement,
  // on crée donc un trace par segment avec la couleur associée.
  const traces = [];
  for (let i = 0; i < values.length - 1; i++) {
    const color = getColorForValue((values[i] + values[i+1]) / 2)?.toCssColorString?.() || 'rgba(150,150,150,0.8)';
    traces.push({
      x: [labels[i], labels[i+1]],
      y: [values[i], values[i+1]],
      mode: 'lines+markers',
      line: { color: color, width: 2, shape: 'spline', smoothing: 0.3 },
      marker: { size: 4, color: color },
      showlegend: false,
      hoverinfo: 'x+y'
    });
  }

  const title = variable ? `Profil temporel moyen de ${varToChart(variable)}` : 'Profil temporel moyen';

  const layout = {
    title: { text: title, font: { size: 18, family: 'Arial, sans-serif', color: '#fff' } },
    xaxis: {
      title: 'Temps',
      tickangle: -45,
      tickfont: { color: '#fff' },
      zeroline: false,
      showgrid: false
    },
    yaxis: {
      title: variable ? `Valeur moyenne de ${varToChart(variable)} (${unit})` : `Valeur moyenne (${unit})`,
      tickfont: { color: '#fff' },
      zeroline: false,
      showgrid: true
    },
    plot_bgcolor: '#222',
    paper_bgcolor: '#222',
    margin: { t: 50, r: 20, b: 100, l: 70 }
  };

  Plotly.newPlot(div, traces, layout, {responsive: true});
}

/**
 * Crée et affiche un histogramme sur le div 'canvas-histogram'.
 */
export function createHistogramFeature(data, binSize = 1) {
  const allValues = data.values.flat().filter(v => typeof v === 'number' && !isNaN(v));

  let min = Infinity;
  let max = -Infinity;
  for (const v of allValues) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const start = Math.floor(min / binSize) * binSize;
  const end = Math.ceil(max / binSize) * binSize;

  const binCount = Math.ceil((end - start) / binSize);

  // Initialiser compteurs pour chaque bin
  const counts = new Array(binCount).fill(0);
  const binValues = Array.from({length: binCount}, () => []);

  // Rassembler valeurs dans chaque bin
  for (const val of allValues) {
    const binIndex = Math.floor((val - start) / binSize);
    if (binIndex >= 0 && binIndex < binCount) {
      counts[binIndex]++;
      binValues[binIndex].push(val);
    }
  }

  const binsLabels = [];
  for (let i = 0; i < binCount; i++) {
    binsLabels.push(`${(start + i*binSize).toFixed(2)} - ${(start + (i+1)*binSize).toFixed(2)}`);
  }

  // Calcul couleur pour chaque bin selon moyenne des valeurs dans le bin
  const barColors = binValues.map(vals => {
    if (vals.length === 0) return 'rgba(200,200,200,0.5)';
    const avg = vals.reduce((sum,v) => sum+v, 0) / vals.length;
    return getColorForValue(avg)?.toCssColorString?.() || 'rgba(200,200,200,0.5)';
  });

  setupHistogramChart(binsLabels, counts, data.unit, data.variable, barColors);
}

function setupHistogramChart(labels, counts, unit = 'µg/m³', variable = '', barColors = []) {
  const div = document.getElementById('canvas-histogram');

  const title = `Distribution des valeurs de ${varToChart(variable) || 'valeurs'}`;

  const trace = {
    x: labels,
    y: counts,
    type: 'bar',
    marker: {
      color: barColors,
      line: { width: 1, color: barColors }
    },
    hoverinfo: 'x+y',
    showlegend: false
  };

  const layout = {
    title: { text: title, font: { size: 18, color: '#fff' } },
    xaxis: {
      title: `Intervalles de ${unit || 'valeurs'}`,
      tickangle: -45,
      tickfont: { color: '#fff' },
      zeroline: false,
      showgrid: false
    },
    yaxis: {
      title: 'Nombre de points',
      tickfont: { color: '#fff' },
      zeroline: false,
      showgrid: true
    },
    plot_bgcolor: '#222',
    paper_bgcolor: '#222',
    margin: { t: 50, r: 20, b: 100, l: 70 }
  };

  Plotly.newPlot(div, [trace], layout, {responsive: true});
}

/**
 * Initialise ou met à jour tous les graphiques
 */
export function initAllCharts(data) {
  clearCharts();
  createAverageProfileFeature(data);
  createHistogramFeature(data);
  //createHeatmapFeature(data); // si jamais tu la rajoutes
}

/**
 * Met à jour dynamiquement les couleurs des graphiques selon la nouvelle palette.
 */
export function updateColorChart() {
  // === 1. Recoloration du profil moyen ===
  const profileDiv = document.getElementById('canvas-profile');
  if (profileDiv && profileDiv.data && profileDiv.data.length > 0) {
    const traces = profileDiv.data;
    traces.forEach(trace => {
      if(trace.y && trace.y.length === 2 && trace.x.length === 2){
        const avgVal = (trace.y[0] + trace.y[1]) / 2;
        const newColor = getColorForValue(avgVal)?.toCssColorString?.() || 'rgba(150,150,150,0.8)';
        trace.line.color = newColor;
        trace.marker.color = newColor;
      }
    });
    Plotly.redraw(profileDiv);
  }

  // === 2. Recoloration de l’histogramme ===
  const histDiv = document.getElementById('canvas-histogram');
  if (histDiv && histDiv.data && histDiv.data.length > 0) {
    const trace = histDiv.data[0];
    const labels = trace.x;
    // Recalculer les couleurs des barres
    const newColors = labels.map(label => {
      const [minStr, maxStr] = label.split(' - ');
      const avg = (parseFloat(minStr) + parseFloat(maxStr)) / 2;
      return getColorForValue(avg)?.toCssColorString?.() || 'rgba(200,200,200,0.5)';
    });

    trace.marker.color = newColors;
    trace.marker.line.color = newColors;

    Plotly.redraw(histDiv);
  }
}
