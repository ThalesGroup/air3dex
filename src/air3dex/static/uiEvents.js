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
 * @file uiEvents.js
 * @description Configure les événements UI pour :
 * - afficher/masquer le formulaire,
 * - activer/désactiver la légende des couleurs,
 * - afficher/masquer les champs de saisie manuelle de l’échelle.
 */
export function setupUIEvents() {
  // Afficher / masquer le formulaire
  /*
  document.getElementById("form-link").addEventListener("click", (event) => {
    event.preventDefault();
    const form = document.getElementById("data-form");
    const link = event.target;

    const isHidden = (form.style.display === "none" || form.style.display === "");
    form.style.display = isHidden ? "block" : "none";
    link.textContent = isHidden ? "Masquer le formulaire ⤣" : "Afficher le formulaire ⤦";
  });*/

  // Afficher / masquer la légende
  document.getElementById("legende-switch").addEventListener("change", function () {
    const legend = document.getElementById("color-legend");
    const label = document.querySelector("label[for='switchCheckChecked']");

    if (!this.checked) {
      legend.style.display = "none";
      label.textContent = "Légende désactivée";
    } else {
      legend.style.display = "block";
      label.textContent = "Légende activée";
    }
  });

  // Gestion du changement de mode d’échelle (auto ou manuel)
  const scaleModeSelect = document.getElementById('scale-mode');
  const manualScaleInputs = document.getElementById('manual-scale-inputs');

  scaleModeSelect.addEventListener('change', () => {
    if (scaleModeSelect.value === 'manual') {
      manualScaleInputs.style.display = 'block';
    } else {
      manualScaleInputs.style.display = 'none';
    }
  });
}