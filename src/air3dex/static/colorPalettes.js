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
 * @file colorPalettes.js
 * @description Gère les palettes de couleurs, l'affichage de la color bar et le menu de sélection.
 * Fournit aussi une fonctionnalité "reverse" qui bascule entre la palette choisie
 * et sa version inversée (soit via une entrée _r existante dans `palettes`, soit
 * en inversant dynamiquement le tableau de couleurs).
*/

import { updateColorChart } from "./chartAnalyzer.js";

/**
 * Liste des palettes disponibles (Lookup Tables - LUTs).
 * Tu peux ajouter ici d'autres palettes ou des versions "_r" pré-calculées.
 */
export const palettes = {
  default: ['#009800', '#e7d900', '#ff8300', '#ff1700', '#a3134d', '#550a27'],
  viridis: ['#fde725', '#7ad151', '#22a884', '#2a788e', '#414487', '#440154'],
  plasma: ['#f0f921', '#fca636', '#e16462', '#b12a90', '#6a00a8', '#0d0887'],
  inferno: ['#fcffa4', '#fca50a', '#dd513a', '#932667', '#420a68', '#000004'],
  magma: ['#fcfdbf', '#fe9f6d', '#de4968', '#8c2981', '#3b0f70', '#000004'],
  //turbo: ['#30123B', '#3B82F6', '#46E160', '#F9E62B', '#F58C1F', '#D7210A'],
  turbo: ["#440154", "#482878", "#3E4989", "#31688E", "#26828E",  "#1F9E89", "#35B779", "#6CCE59", "#B4DD2C", "#FDE725"],
  coolwarm: ['#0000ff', '#5555ff', '#aaaaaa', '#ffaaaa', '#ff5555', '#ff0000'],
  blues: ['#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'],
  reds: ['#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#de2d26', '#a50f15'],
  reds2: ['#de2d26'],
  sand: ['#c2a77c']
};

const paletteLabels = {
  default: 'Défaut',
  viridis: 'Viridis',
  plasma: 'Plasma',
  inferno: 'Inferno',
  magma: 'Magma',
  turbo: 'Turbo',
  coolwarm: 'Coolwarm',
  blues: 'Bleus',
  reds: 'Rouges',
  reds2: 'Rouge Uni',
  sand: 'Sable'
};


// Palette active (array de couleurs)
export let colorRange = palettes.default.slice();

// Clé de la palette actuellement sélectionnée (ex: 'viridis' ou 'viridis_r')
export let currentPaletteKey = 'default';

// Flag indiquant si la sélection est actuellement l'inversée
let isReversed = false;

/**
 * Met à jour la color bar DOM (élément avec id 'color-bar' par défaut).
 * Accepte soit le nom d'une palette, soit directement un tableau de couleurs.
 * @param {string|Array<string>} paletteOrColors
 */
export function updateColorBar(paletteOrColors) {
  let colors;
  if (Array.isArray(paletteOrColors)) {
    colors = paletteOrColors.slice();
  } else if (typeof paletteOrColors === 'string') {
    colors = palettes[paletteOrColors] ? palettes[paletteOrColors].slice() : palettes.default.slice();
  } else {
    colors = palettes.default.slice();
  }

  colorRange = colors;

  const colorBar = document.getElementById('color-bar');
  if (!colorBar) return;

  const denom = colors.length > 1 ? (colors.length - 1) : 1;
  const colorStops = colors.map((color, i) => `${color} ${i * (100 / denom)}%`).join(', ');
  colorBar.style.background = `linear-gradient(to right, ${colorStops})`;
}

/**
 * Crée une image preview (base64) pour une palette
 * @param {string[]} colors
 * @returns {string} dataURL
 */
export function createPalettePreview(colors) {
  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 10;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  const denom = colors.length > 1 ? (colors.length - 1) : 1;
  colors.forEach((color, i) => {
    gradient.addColorStop(i / denom, color);
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL();
}

/**
 * Retourne une copie inversée d'un tableau de couleurs (sans muter l'original).
 * @param {string[]} colors
 * @returns {string[]}
 */
export function reversed(colors) {
  return colors.slice().reverse();
}

/**
 * Formate le label d'une palette pour l'affichage dans l'UI
 * @param {string} name
 * @returns {string}
 */
function formatPaletteLabel(name) {
  if (!name) return '';
  if (name.endsWith('_r')) {
    const base = name.slice(0, -2);
    return paletteLabels[base] || (base.charAt(0).toUpperCase() + base.slice(1));
  }
  return paletteLabels[name] || (name.charAt(0).toUpperCase() + name.slice(1));
}
/**
 * Construit le menu déroulant des palettes et attache les événements.
 * Options possibles pour les IDs des éléments DOM (utile si ton HTML diffère).
 * @param {Object} opts
 * @param {string} opts.paletteListId - id de la <ul> contenant la liste (default: 'palette-list')
 * @param {string} opts.selectedPaletteId - id de l'élément affichant le nom sélectionné (default: 'selected-palette-name')
 * @param {string} opts.colorBarId - id de la barre de couleur (default: 'color-bar')
 * @param {string} opts.reverseBtnId - id du bouton reverse (default: 'reverse-palette-btn')
 */
export function buildPaletteMenu(opts = {}) {
  const {
    paletteListId = 'palette-list',
    selectedPaletteId = 'selected-palette-name',
    colorBarId = 'color-bar',
    reverseBtnId = 'reverse-palette-btn'
  } = opts;

  const paletteList = document.getElementById(paletteListId);
  const paletteSelect = document.getElementById(selectedPaletteId);

  if (!paletteList || !paletteSelect) {
    console.warn('buildPaletteMenu: éléments DOM requis introuvables (palette-list / selected-palette-name)');
    return;
  }

  // construit la liste
  paletteList.innerHTML = '';
  Object.entries(palettes).forEach(([name, colors]) => {
    const item = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'dropdown-item d-flex align-items-center gap-2';
    btn.type = 'button';
    btn.style.padding = '5px 10px';
    btn.dataset.palette = name;

    const img = document.createElement('img');
    img.src = createPalettePreview(colors);
    img.width = 80;
    img.height = 10;
    img.alt = `${name} preview`;

    const label = document.createElement('span');
    label.textContent = formatPaletteLabel(name);

    btn.appendChild(img);
    btn.appendChild(label);
    item.appendChild(btn);
    paletteList.appendChild(item);
  });

  // gestion du click sur une entrée
  paletteList.addEventListener('click', (e) => {
    const target = e.target.closest('button[data-palette]');
    if (!target) return;

    const paletteName = target.dataset.palette;
    currentPaletteKey = paletteName;
    isReversed = paletteName.endsWith('_r');

    // si palette existante -> copie, sinon fallback
    colorRange = palettes[paletteName] ? palettes[paletteName].slice() : palettes.default.slice();

    paletteSelect.textContent = formatPaletteLabel(paletteName);
    updateColorBar(colorRange);
    updateColorChart();
  });

  // bouton Reverse : si l'utilisateur a déjà un bouton dans le HTML avec l'ID souhaité on l'utilise,
  // sinon on le crée automatiquement et on l'insère après le dropdown (id 'color-palette-dropdown')
  let reverseBtn = document.getElementById(reverseBtnId);
  if (!reverseBtn) {
    const dropdownContainer = document.getElementById('color-palette-dropdown');
    if (dropdownContainer) {
      reverseBtn = document.createElement('button');
      reverseBtn.id = reverseBtnId;
      reverseBtn.type = 'button';
      reverseBtn.className = 'btn btn-secondary btn-sm ms-2';
      reverseBtn.textContent = 'Reverse';
      reverseBtn.setAttribute('title', 'Inverser la palette sélectionnée');
      dropdownContainer.insertAdjacentElement('afterend', reverseBtn);
    }
  }

  if (reverseBtn) {
    reverseBtn.addEventListener('click', () => toggleReverse(paletteSelect, document.getElementById(colorBarId)));
  }

  // initialisation de l'affichage
  paletteSelect.textContent = formatPaletteLabel(currentPaletteKey);
  updateColorBar(colorRange);
}

/**
 * Bascule entre la palette courante et sa version inversée.
 * Si une version `_r` existe dans `palettes`, on l'utilise en priorité.
 * Sinon on inverse dynamiquement le tableau.
 * @param {HTMLElement} paletteSelectElement - élément texte à mettre à jour (optionnel)
 * @param {HTMLElement} colorBarElement - élément color-bar (optionnel)
 */
export function toggleReverse(paletteSelectElement, colorBarElement) {
  const baseKey = currentPaletteKey.endsWith('_r') ? currentPaletteKey.slice(0, -2) : currentPaletteKey;
  const reversedKey = `${baseKey}_r`;

  if (palettes[reversedKey]) {
    // il existe une palette explicitement définie en _r -> toggle entre baseKey et reversedKey
    currentPaletteKey = (currentPaletteKey === reversedKey) ? baseKey : reversedKey;
    colorRange = palettes[currentPaletteKey].slice();
  } else {
    // pas de _r défini -> on inverse dynamiquement
    if (currentPaletteKey.endsWith('_r')) {
      // on revient à la base
      currentPaletteKey = baseKey;
      colorRange = palettes[baseKey].slice();
    } else {
      // on passe en version inversée (key marquée _r)
      currentPaletteKey = reversedKey;
      colorRange = reversed(palettes[baseKey]);
    }
  }

  isReversed = currentPaletteKey.endsWith('_r');

  // Mise à jour UI
  if (paletteSelectElement) paletteSelectElement.textContent = formatPaletteLabel(currentPaletteKey);
  if (colorBarElement) updateColorBar(colorRange);
  else updateColorBar(colorRange);

  // Mise à jour des graphiques / autres modules
  try {
    updateColorChart();
  } catch (err) {
    // updateColorChart peut ne pas exister en test unitaire ; on ignore l'erreur ici.
  }
}

/**
 * Fonction d'init pratique : construit le menu et attache les contrôles.
 * Appelle buildPaletteMenu avec les options fournies.
 * @param {Object} opts - mêmes options que buildPaletteMenu
 */
export function initColorPalettes(opts = {}) {
  buildPaletteMenu(opts);
}

// export par défaut optionnel
export default {
  palettes,
  colorRange,
  currentPaletteKey,
  updateColorBar,
  createPalettePreview,
  buildPaletteMenu,
  toggleReverse,
  initColorPalettes
};
