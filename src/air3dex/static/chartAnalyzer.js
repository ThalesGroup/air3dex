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
 * @file chartAnalyzer.js : 
 * @description Gère la génération et l'affichage des visualisations statistiques (profil moyen, histogramme, heatmap)
 * ainsi que le basculement entre ces modes de graphiques.
 */

import { getColorForValue } from "./scaleModes.js";

function varToChart(rawVar) {
  const map = {
    "pm10_conc": "PM10",
    "pm2p5_conc": "PM2.5",
    "pmwf_conc": "PM10 (feux)",
    "dust" : "Dust (une fraction des PM10)",
    "no2_conc": "NO₂",
    "o3_conc": "O₃",
    "co_conc": "CO"
  };
  return map[rawVar] || rawVar || "—";
}

export function clearCharts() {
  if (window.graphProfileChart) {
    window.graphProfileChart.destroy();
    window.graphProfileChart = null;
  }
  if (window.graphHistogramChart) {
    window.graphHistogramChart.destroy();
    window.graphHistogramChart = null;
  }
  /*
  if (window.graphHeatmapChart) {
    window.graphHeatmapChart.dispose();
    window.graphHeatmapChart = null;
  }*/
}

/**
 * Affiche le profil moyen temporel sur le canvas unique.
 */
export function createAverageProfileFeature(data) {
  const avgProfiles = computeAverageProfilesByLevel(data);
  setupAverageProfileChartByLevel(avgProfiles, data.unit, data.variable);
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

/**
 * Calcule un profil moyen par altitude à chaque instant t,
 * en déduisant les altitudes depuis data.positions[][2].
 */
function computeAverageProfilesByLevel(data) {
  const timestamps = data.timestamps;
  const nbTimes = timestamps.length;
  const nbPoints = data.values.length;

  // Extraire l'altitude de chaque point
  const altitudes = data.positions.map(pos => pos[2]);

  // Structure : { altitude: { sum: [], count: [] } }
  const profiles = {};

  for (let p = 0; p < nbPoints; p++) {
    const alt = altitudes[p];
    if (!profiles[alt]) {
      profiles[alt] = {
        sum: new Array(nbTimes).fill(0),
        count: new Array(nbTimes).fill(0)
      };
    }
    for (let t = 0; t < nbTimes; t++) {
      profiles[alt].sum[t] += data.values[p][t];
      profiles[alt].count[t] += 1;
    }
  }

  // Moyenne par altitude et par instant
  const avgProfiles = {};
  for (const alt in profiles) {
    avgProfiles[alt] = profiles[alt].sum.map((total, t) => total / profiles[alt].count[t]);
  }

  return { timestamps, avgProfiles };
}


function setupAverageProfileChart(avgProfiles, unit = 'µg/m³', variable = '') {
  if (window.graphProfileChart && typeof window.graphProfileChart.destroy === 'function') {
    window.graphProfileChart.destroy();
    window.graphProfileChart = null;
  }

  const canvas = document.getElementById('canvas-profile');
  const ctx = canvas.getContext('2d');

  const values = avgProfiles.meanValues;

  const labels = avgProfiles.timestamps.map(t => {
    const date = new Date(t);
    const dayMonthYear = date.toLocaleDateString('fr-FR', { year: '2-digit', month: '2-digit', day: '2-digit' });
    const hour = date.getHours().toString().padStart(2, '0') + 'h';
    return `${dayMonthYear} ${hour}`;
  });

  const yAxisTitle = variable ? `Valeur moyenne de ${varToChart(variable)} (${unit})` : `Valeur moyenne (${unit})`;
  const datasetLabel = variable ? `${varToChart(variable)} moyen (${unit})` : `Valeur moyenne (${unit})`;

  window.graphProfileChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: datasetLabel,
        data: values,
        pointRadius: 1,
        fill: false,
        tension: 0.3,
        segment: {
          borderColor: ctx => {
            const val0 = values[ctx.p0DataIndex];
            const val1 = values[ctx.p1DataIndex];
            const avgVal = (val0 + val1) / 2;
            return getColorForValue(avgVal)?.toCssColorString?.() || 'rgba(150,150,150,0.8)';
          }
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: variable 
            ? `Profil temporel moyen - ${varToChart(variable)}` 
            : 'Profil temporel moyen',
          color: '#ffffff'
        },
        legend: false
      },
      scales: {
        x: {
          display: true,
          title: { display: true, text: 'Temps', color: '#ffffff' },
          ticks: { color: '#ffffff' }
        },
        y: {
          display: true,
          title: { display: true, text: yAxisTitle, color: '#ffffff' },
          ticks: { color: '#ffffff' }
        }
      }
    }
  });
}



function setupAverageProfileChartByLevel(profilesData, unit = 'µg/m³', variable = '') {
  if (window.graphProfileChart && typeof window.graphProfileChart.destroy === 'function') {
    window.graphProfileChart.destroy();
    window.graphProfileChart = null;
  }

  const canvas = document.getElementById('canvas-profile');
  const ctx = canvas.getContext('2d');

  const labels = profilesData.timestamps.map(t => {
    const date = new Date(t);
    const dayMonthYear = date.toLocaleDateString('fr-FR', { year: '2-digit', month: '2-digit', day: '2-digit' });
    const hour = date.getHours().toString().padStart(2, '0') + 'h';
    return `${dayMonthYear} ${hour}`;
  });

  const colorPalette = [
    '#76451d', '#b1682c', '#ec8a3a', '#f09f5e', '#f8cfaf',
    '#b1d8f8', '#63b1f1', '#48a3ee', '#367bb3', '#245277'
  ];

  const yAxisTitle = variable ? `Valeur moyenne de ${varToChart(variable)} (${unit})` : `Valeur moyenne (${unit})`;
  const datasets = Object.entries(profilesData.avgProfiles).map(([alt, values], idx) => ({
    label: `Alt. ${alt / 20}m`,
    data: values,
    borderColor: colorPalette[idx % colorPalette.length],
    backgroundColor: 'transparent',
    pointRadius: 1,
    tension: 0.3,
    segment: undefined
  }));

  window.graphProfileChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: variable
            ? `Profil temporel moyen par altitude - ${varToChart(variable)}`
            : 'Profil temporel moyen par altitude',
          color: '#fff'
        },
        legend: {
          position: 'bottom',
          labels: {
            color: '#fff',
            font: {
              size: 10
            },
            boxWidth: 10,
            padding: 8
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: { display: true, text: 'Temps', color: '#ffffff' },
          ticks: { color: '#ffffff' }
        },
        y: {
          display: true,
          title: { display: true, text: yAxisTitle, color: '#ffffff' },
          ticks: { color: '#ffffff' }
        }
      }
    }
  });
}

/**
 * Crée et affiche un histogramme sur le canvas unique.
*/
export function createHistogramFeature(data, binSize = 1) {
  const allValues = data.values.flat().filter(v => typeof v === 'number' && !isNaN(v));

  let min = Infinity;
  let max = -Infinity;
  for (const v of allValues) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  if (typeof getColorForValue.minValue === 'number') min = getColorForValue.minValue;
  if (typeof getColorForValue.maxValue === 'number') max = getColorForValue.maxValue;
  
  const start = Math.floor(min / binSize) * binSize;
  const end = Math.ceil(max / binSize) * binSize;

  const bins = [];
  const binValues = [];
  const counts = [];

  const binCount = Math.ceil((end - start) / binSize);

  for (let i = 0; i < binCount; i++) {
    const rangeStart = start + i * binSize;
    const rangeEnd = rangeStart + binSize;
    bins.push(`${rangeStart} - ${rangeEnd}`);
    binValues.push([]);
    counts.push(0);
  }

  for (const val of allValues) {
    const binIndex = Math.floor((val - start) / binSize);
    if (binIndex >= 0 && binIndex < binCount) {
      binValues[binIndex].push(val);
      counts[binIndex]++;
    }
  }

  const backgroundColors = binValues.map(values => {
    if (values.length === 0) return 'rgba(200,200,200,0.5)';
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const color = getColorForValue(avg);
    const cssColor = color?.toCssColorString?.() ?? 'rgba(200,200,200,0.5)';
    //console.log(`Bin avg=${avg.toFixed(2)}, color=${cssColor}`);
    return cssColor;
  });

  setupHistogramChart(bins, counts, data.unit, data.variable, backgroundColors);
}

/**
 * Initialise ou met à jour l'histogramme.
 */
function setupHistogramChart(labels, counts, unit = 'µg/m³', variable = '', backgroundColors = []) {
  if (window.graphHistogramChart && typeof window.graphHistogramChart.destroy === 'function') {
    window.graphHistogramChart.destroy();
    window.graphHistogramChart = null;
  }

  const ctx = document.getElementById('canvas-histogram').getContext('2d');

  const yAxisTitle = 'Nombre de points';
  const datasetLabel = variable ? `Distribution de ${varToChart(variable)}` : 'Distribution des valeurs';

  window.graphHistogramChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: datasetLabel,
        data: counts,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors.map(c=>c),
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `Distribution des valeurs - ${varToChart(variable) || 'valeurs'}`,
          color: '#ffffff'
        },
        legend: false
      },
      scales: {
        x: {
          title: { 
            display: true, 
            text: `Intervalles de ${unit || 'valeurs'}`,
            color: '#ffffff'
          },
          ticks: {
            color: '#ffffff'
          }
        },
        y: {
          title: { 
            display: true, 
            text: yAxisTitle,
            color: '#ffffff'
          },
          ticks: {
            color: '#ffffff'
          },
          beginAtZero: true
        }
      }
    }
  });
}

export function initAllCharts(data) {
  clearCharts();
  createAverageProfileFeature(data);
  createHistogramFeature(data);
  //createHeatmapFeature(data);

  const btnToggle = document.getElementById('btn-toggle-profile');
  let showAverageByAltitude = false;

  // Affichage initial
  const avgProfile = computeAverageProfile(data);
  setupAverageProfileChart(avgProfile, data.unit, data.variable);
  btnToggle.textContent = 'Voir profil moyen par altitude';

  btnToggle.addEventListener('click', () => {
    showAverageByAltitude = !showAverageByAltitude;

    if (showAverageByAltitude) {
      createAverageProfileFeature(data);
      btnToggle.textContent = 'Voir profil moyen général';
    } else {
      const avgProfile = computeAverageProfile(data);
      setupAverageProfileChart(avgProfile, data.unit, data.variable);
      btnToggle.textContent = 'Voir profil moyen par altitude';
    }
  });
}

/**
 * Met à jour dynamiquement les couleurs des graphiques selon les nouvelles valeurs
 * de la palette (utile après un changement de palette ou de seuils).
 */
export function updateColorChart() {
  // === 1. Recoloration du profil moyen ===
  if (window.graphProfileChart && window.graphProfileChart.data.datasets.length > 0) {
    const chart = window.graphProfileChart;
    const values = chart.data.datasets[0].data;
    const n = values.length;

    const canvas = chart.canvas;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);

    values.forEach((val, i) => {
      const t = i / (n - 1);
      const color = getColorForValue(val)?.toCssColorString?.() || 'rgba(150,150,150,0.8)';
      gradient.addColorStop(t, color);
    });

    chart.data.datasets[0].borderColor = gradient;
    chart.update();
  }

  // === 2. Recoloration de l’histogramme ===
  if (window.graphHistogramChart && window.graphHistogramChart.data.datasets.length > 0) {
    const chart = window.graphHistogramChart;
    const values = chart.data.datasets[0].data;
    const labels = chart.data.labels;

    const backgroundColors = labels.map((label, i) => {
      const count = values[i];
      if (count === 0) return 'rgba(200,200,200,0.5)';

      // Essaie de reconstruire une valeur moyenne à partir du label si possible
      const [minStr, maxStr] = label.split(' - ');
      const avg = (parseFloat(minStr) + parseFloat(maxStr)) / 2;
      return getColorForValue(avg)?.toCssColorString?.() || 'rgba(200,200,200,0.5)';
    });

    chart.data.datasets[0].backgroundColor = backgroundColors;
    chart.data.datasets[0].borderColor = backgroundColors;
    chart.update();
  }
}

/*
export function createHeatmapFeature(data) {
  // Détruire le graphique précédent
  if (window.graphHeatmapChart && typeof window.graphHeatmapChart.dispose === 'function') {
    window.graphHeatmapChart.destroy();
    window.graphHeatmapChart = null;
  }
  
  const container = document.getElementById('canvas-heatmap');
  // Initialiser ECharts
  const chart = echarts.init(container);
  window.graphChart = chart;

  const timestamps = data.timestamps.map(t => {
    const d = new Date(t);
    return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}h`;
  });

  const altitudes = data.levels
  const values = data.values;

  // Transfert en format [[x, y, value]]
  const matrixData = [];
  for (let row = 0; row < values.length; row++) {
    for (let col = 0; col < values[0].length; col++) {
      matrixData.push([col, row, values[row][col]]);
    }
  }

  let minValue = Infinity;
  let maxValue = -Infinity;

  for (const row of values) {
    for (const v of row) {
      if (v < minValue) minValue = v;
      if (v > maxValue) maxValue = v;
    }
  }

  const option = {
    title: {
      text: `Évolution temporelle moyenne de ${data.variable || 'la variable'}\n(par niveau sous forme de Heatmap)`,
      left: 'center'
    },
    tooltip: {
      position: 'top',
      formatter: function (params) {
        const value = params.data[2];
        return `
          <strong>${timestamps[params.data[0]]}</strong><br/>
          Niveau : ${altitudes[params.data[1]]}<br/>
          Valeur : ${value.toFixed(2)} µg/m³
        `;
      }
    },
    grid: {
      height: '75%',
      top: 60
    },
    xAxis: {
      type: 'category',
      data: timestamps,
      name: 'Temps',
      nameLocation: 'middle',
      nameGap: 50,
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: {
      type: 'category',
      data: altitudes,
      name: 'Niveau (m)',
      nameLocation: 'middle',
      nameGap: 40
    },
    visualMap: {
      min: minValue,
      max: maxValue,
      calculable: true,
      orient: 'vertical',
      right: '5%',
      top: 'middle',
      text: ['Valeur moyenne (µg/m³)', '']
    },
    series: [{
      name: 'Concentration',
      type: 'heatmap',
      data: matrixData,
      emphasis: {
        itemStyle: {
          borderColor: '#333',
          borderWidth: 1
        }
      },
      progressive: 1000,
      animation: false
    }]
  };

  chart.setOption(option);
}*/
