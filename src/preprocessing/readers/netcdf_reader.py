# Copyright (c) 2025-2026 Thales Services Numeriques (TSN).
#
# This file is part of Air3Dex
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Ce module contient des fonctions pour lire des fichiers NetCDF,
générer des graphiques, et convertir les données en JSON.
"""

import json
import os
import time
from datetime import datetime, timedelta

import matplotlib.colors as mcolors
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import xarray as xr
from mpl_toolkits.axes_grid1.inset_locator import inset_axes
from pyproj import Transformer
from scipy.interpolate import RegularGridInterpolator, griddata
from scipy.ndimage import gaussian_filter
from tqdm import tqdm
from utils.logger import (
    BOLD,
    GREEN,
    MAGENTA,
    RESET,
    log_analyse,
    log_export,
    log_plot,
    log_separate,
)


class NetCDFReader:
    """
    Classe pour convertir un fichier NetCDF 4D (longitude, latitude, niveau, temps)
    en un fichier JSON optimisé pour la visualisation 3D (ex: Cesium ou Three.js).
    """

    def __init__(self, input_path, variable, seuil, step_lat, step_lon):
        """Initialise le convertisseur avec les paramètres nécessaires

        Args:
            input_path (str): Chemin du fichier NetCDF en entrée.
            variable (str): Nom de la variable à extraire (ex: "pm10_conc", "pm2p5_conc").
            seuil (int): Seuil minimum à partir duquel les valeurs sont prises en compte.
            step_lat (int): Pas d'échantillonnage des latitudes.
            step_lon (int): Pas d'échantillonnage des longitudes.
        """
        self.input_path = input_path
        self.variable = variable
        self.seuil = seuil
        self.step_lat = step_lat
        self.step_lon = step_lon

        log_separate("Résumé du Dataset NetCDF", color="green")
        log_analyse(f"Dataset en entrée : {BOLD}{MAGENTA}{os.path.basename(self.input_path)}{RESET}")

        self.ds = xr.open_dataset(input_path)
        log_analyse(self.ds)
        self.data_var = self.ds[variable]
        self.unit = None
        self.lons = None
        self.lats = None
        self.lvls = None
        self.altitudes = None
        self.times = None
        self.start_date = None
        self.cesium_times = None

    def extract_start_date(self):
        """
        Extrait la date de début à partir des métadonnées du fichier NetCDF.
        Gère les formats :
        - "YYYYMMDD-YYYYMMDD+…"
        - "YYYYMMDD+…"
        - fallback sur self.times[0], qu’il s’agisse de Timestamp, Timedelta ou autre.
        Returns:
            str: Date de début au format ISO (YYYY‑MM‑DDThh:mm:ss)
        """
        raise NotImplementedError

    def compute_cesium_times(self):
        """
        Calcule les timestamps compatibles avec Cesium (ISO8601 + "Z").
        Se base sur self.start_date ET sur self.times (Timestamp, Timedelta ou autre).
        Returns:
            list[str]: Liste de timestamps ISO8601 UTC, ex. "2025-06-25T00:00:00Z"
        """
        t0 = pd.Timestamp(self.start_date)
        iso = []

        for t in self.times:
            if isinstance(t, pd.Timestamp):
                dt = t
            elif isinstance(t, pd.Timedelta):
                dt = t0 + t
            elif isinstance(t, np.datetime64):
                dt = pd.Timestamp(t)
            else:
                # numpy.timedelta64, numpy.datetime64, int, etc.
                dt = t0 + pd.to_timedelta(t)

            # On force l'affichage en UTC (Z)
            iso.append(dt.isoformat() + "Z")

        log_analyse(f"Cesium times [:5] : {iso[:5]}\n")
        return iso

    def get_data_var(self):
        """Extrait la variable de données principale du fichierNetCDF en sous-échantillonant
        selon les pas définis

        Returns:
            np.ndarray: Tableau 4D de type float32 avec les dimensions (time, level, lat, lon).
        """
        raise NotImplementedError

    def get_time_series(self, data_var, lvl, lat, lon):
        """Extrait la série temporelle d'une cellule spécifique (level, lat, lon)
        à partir du  tableau de données.

        Args:
            data_var (np.ndarray): Données 4D (time, level, lat, lon) extraites par get_data_var().
            lvl (int): Indice du niveau d'altitude.
            lat (int): Indice de la latitude.
            lon (int): Indice de la longitude.

        Returns:
            np.ndarray: Série temporelle (1D) des valeurs à cette position.
        """
        raise NotImplementedError()

    def apply_land_sea_mask(self, mask_path, land_only=True, method="nearest"):
        """
        Applique un masque Terre/Mer (issu d'un fichier NetCDF) aux données CAMS.

        Args:
            mask_path (str): Chemin vers le fichier NetCDF contenant la variable 'lsm'.
            land_only (bool):
                - True = garder uniquement la terre (lsm==1).
                - False = garder uniquement la mer (lsm==0).
            method (str): Méthode d'interpolation spatiale ('nearest' ou 'linear').

        Returns:
            xr.Dataset: Nouveau Dataset masqué, de mêmes dimensions que self.ds.
        """
        # Charger le masque
        mask_ds = xr.open_dataset(mask_path)
        lsm = mask_ds["lsm"]

        # Harmoniser le sens des latitudes si nécessaire
        if (lsm.latitude[0] < lsm.latitude[-1]) and (self.ds.latitude[0] > self.ds.latitude[-1]):
            lsm = lsm.reindex(latitude=list(reversed(lsm.latitude)))

        # Interpoler le masque sur la grille du dataset courant
        lsm_on_grid = lsm.interp(latitude=self.ds.latitude, longitude=self.ds.longitude, method=method)

        # Appliquer le masque
        target = 1 if land_only else 0
        masked_ds = self.ds.where(lsm_on_grid == target)

        return masked_ds

    # ========================================= SECTION PLOT's =========================================
    def get_cmap(self, name=None):
        """
        Retourne une colormap personnalisée.

        Args:
            name (str): Nom de la colormap ("default", "sand", ...).

        Returns:
            matplotlib.colors.Colormap
        """
        if name is None or name == "default":
            custom_colors = ["#009800", "#e7d900", "#ff8300", "#ff1700", "#a3134d", "#550a27"]
            return mcolors.LinearSegmentedColormap.from_list("my_cmap", custom_colors, N=256)

        elif name == "sand":
            base_rgb = mcolors.to_rgb("#c2a77c")
            colors = [(base_rgb[0], base_rgb[1], base_rgb[2], alpha) for alpha in np.linspace(1, 0, 256)]
            # inverser pour que foncé soit max et transparent min
            colors = colors[::-1]
            return mcolors.ListedColormap(colors, name="sand_cmap")

        else:
            raise ValueError(f"Colormap '{name}' non définie.")

    def plot_value_distribution(self, values, output_dir):
        """Génération de deux histogrammes représentant la distribution des valeurs :
            un avec tous les points et un autre sans NaN ni 0.

        Args:
            values (numpy.ndarray): Tableau contenant les valeurs numériques.
            output_dir (str): Chemin du dossier de sortie pour les histogrammes.
        """
        os.makedirs(output_dir, exist_ok=True)

        # Version brute : tout inclut
        all_values_raw = [float(v) if v is not None else np.nan for sublist in values for v in sublist]
        all_values_raw = np.array(all_values_raw, dtype=np.float32)

        # Version nettoyée : supprime NaN et 0
        all_values_clean = [v for v in all_values_raw if not np.isnan(v) and v != 0]
        all_values_clean = np.array(all_values_clean, dtype=np.float32)

        print("RAW")
        print("Valeur min:", np.nanmin(all_values_raw))
        print("Valeur max:", np.nanmax(all_values_raw))
        print("Moyenne:", np.nanmean(all_values_raw))
        print("Écart-type:", np.nanstd(all_values_raw))
        print("Médiane:", np.nanmedian(all_values_raw))
        print("99e percentile:", np.nanpercentile(all_values_raw, 99))
        print("Nombre total de valeurs:", len(all_values_raw))

        print("CLEAN")
        print("Valeur min:", np.nanmin(all_values_clean))
        print("Valeur max:", np.nanmax(all_values_clean))
        print("Moyenne:", np.nanmean(all_values_clean))
        print("Écart-type:", np.nanstd(all_values_clean))
        print("Médiane:", np.nanmedian(all_values_clean))
        print("99e percentile:", np.nanpercentile(all_values_clean, 99))
        print("Nombre total de valeurs:", len(all_values_clean))

        def plot_histogram(data, title_suffix, filename):
            if len(data) == 0:
                log_plot(f"Aucune valeur à tracer pour {title_suffix}.")
                return
            plt.figure(figsize=(8, 5))
            plt.hist(data, bins=50, color="skyblue", edgecolor="black", log=True)
            plt.title(f"Distribution des valeurs de {self.variable} ({title_suffix})")
            plt.xlabel(f"{self.variable} ({self.unit})")
            plt.ylabel("Fréquence")
            plt.grid(True)
            plt.tight_layout()
            output_path = os.path.join(output_dir, filename)
            plt.savefig(output_path, dpi=300)
            plt.close()
            log_plot(f"Histogramme {title_suffix} enregistré dans {output_path}")

        # Histogramme avec tout
        plot_histogram(all_values_raw, "avec NaN et 0", "distribution_raw.png")

        # Histogramme nettoyé
        plot_histogram(all_values_clean, "sans NaN et 0", "distribution_clean.png")

    def plot_temporal_profile(self, values, timestamps, output_dir, ignore_nan=True, ignore_zeros=True):
        """Génération d'un profil temporel représentant l'évolution
            moyenne, maximale et minimale d'une variable au cours du temps.

        Args:
            values (numpy.ndarray): Tableau contenant les valeurs numériques.
            timestamps (list of str): Liste des timestamps au format ISO 8601
                correspondant à chaque pas de temps.
            output_dir (str): Chemin du dossier de sortie dans lequel le graphique sera enregistré.
        """
        os.makedirs(output_dir, exist_ok=True)

        # Remplacer None ou 0 par NaN pour les calculs
        values_array = np.array(
            [
                [
                    np.nan if (ignore_nan and (v is None or np.isnan(v))) or (ignore_zeros and v == 0) else float(v)
                    for v in sublist
                ]
                for sublist in values
            ],
            dtype=np.float32,
        )

        mean_per_time = np.nanmean(values_array, axis=0)
        max_per_time = np.nanmax(values_array, axis=0)
        min_per_time = np.nanmin(values_array, axis=0)

        try:
            # Cas ISO complet avec "Z"
            times = [datetime.strptime(t, "%Y-%m-%dT%H:%M:%SZ") for t in timestamps]
        except Exception:
            # Cas ISO "YYYY-MM-DDTHH:MM:SS" (sans Z)
            times = [datetime.fromisoformat(t) for t in timestamps]

        profiles = {
            "mean": (mean_per_time, "orangered", "Moyenne"),
            "max": (max_per_time, "forestgreen", "Maximum"),
            "min": (min_per_time, "royalblue", "Minimum"),
        }

        for key, (data, color, label) in profiles.items():
            fig, ax = plt.subplots(figsize=(9, 4.5))
            ax.plot(times, data, linestyle="-", color=color, label=label)
            ax.set_title(f"Profil temporel {label} de {self.variable}")
            ax.set_xlabel("Temps")
            ax.set_ylabel(f"Valeur ({self.unit})")
            ax.grid(True)
            ax.legend()
            ax.xaxis.set_major_formatter(mdates.DateFormatter("%d-%m-%y\n%H:%M"))
            ax.tick_params(axis="x", rotation=0)
            fig.tight_layout()

            output_path = os.path.join(output_dir, f"temporal_profile_{key}.png")
            fig.savefig(output_path, dpi=300)
            plt.close(fig)
            log_plot(f"Profil temporel {label} enregistré dans {output_path}")

    def plot_temporal_heatmap_by_level(self, output_dir, zoom_alt=None, cmap=None):
        """
        Pour chaque niveau, calcule l'évolution temporelle moyenne de la variable,
        sauvegarde un CSV (niveaux × timestamps) et trace une heatmap.
        Un inset zoomé est tracé seulement si `zoom_alt` est spécifié.

        Args:
            output_dir (str): Dossier de sortie pour le CSV et l'image.
            zoom_alt (int, optional): Altitude max du zoom pour l'inset. Si None, pas de zoom.
            cmap (str, optional): Colormap matplotlib (par défaut = 'viridis').
        """
        os.makedirs(output_dir, exist_ok=True)

        # --- Données ---
        arr = self.data_var.values  # shape (T, L, lat, lon)
        if arr.size == 0:
            log_plot("[Warning] Aucune donnée à tracer.")
            return

        mean_tl = np.nanmean(arr, axis=(2, 3))  # moyenne spatiale ➔ (T, L)
        times_dt = pd.to_datetime(self.cesium_times)
        levels = np.array(self.lvls)

        # --- DataFrame ---
        df = pd.DataFrame(data=mean_tl.T, index=levels, columns=times_dt)
        df.index.name = "level"
        df.columns.name = "time"

        # --- Sauvegarde CSV ---
        csv_path = os.path.join(output_dir, "temporal_profile_by_level.csv")
        df.to_csv(csv_path)

        # --- Fonction utilitaire pour bords ---
        def compute_edges(coords):
            diffs = np.diff(coords)
            edges = np.concatenate(
                (
                    [coords[0] - diffs[0] / 2],
                    (coords[:-1] + coords[1:]) / 2,
                    [coords[-1] + diffs[-1] / 2],
                )
            )
            return edges

        if cmap is None:
            cmap = self.get_cmap()
        elif cmap == "sand":
            cmap = self.get_cmap("sand")

        # --- Heatmap principale ---
        fig, ax = plt.subplots(figsize=(11, 6), constrained_layout=True)
        x_edges = compute_edges(mdates.date2num(times_dt))
        y_edges = compute_edges(levels)

        mesh = ax.pcolormesh(x_edges, y_edges, df.values, cmap=cmap, shading="auto")
        fig.colorbar(mesh, ax=ax, label=f"Valeur moyenne ({self.unit})")

        # Axe X
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%d-%m-%y\n%H:%M"))
        ax.tick_params(axis="x", rotation=0)

        # Axe Y (on enlève le niveau 50)
        levels_no50 = [lvl for lvl in levels if lvl != 50]
        ax.set_yticks(levels_no50)
        ax.set_yticklabels([f"{lvl:.0f}" for lvl in levels_no50], fontsize=8)

        # Titres
        ax.set_title(f"Évolution temporelle moyenne de {self.variable} par altitude")
        ax.set_xlabel("Temps")
        ax.set_ylabel("Altitude (m)")

        # --- Inset zoom si demandé ---
        if zoom_alt is not None:
            idx_zoom = np.where(levels <= zoom_alt)[0]
            if idx_zoom.size > 1:
                ax_inset = inset_axes(ax, width="40%", height="40%", loc="upper right", borderpad=2)
                levels_zoom = levels[idx_zoom]
                y_edges_zoom = compute_edges(levels_zoom)
                data_zoom = df.values[idx_zoom, :]

                ax_inset.pcolormesh(x_edges, y_edges_zoom, data_zoom, cmap=cmap, shading="auto")
                ax_inset.set_ylim(levels_zoom[0] - 10, levels_zoom[-1] + 10)

                ax_inset.xaxis.set_major_formatter(mdates.DateFormatter("%d-%m\n%H:%M"))
                ax_inset.tick_params(axis="x", rotation=0, colors="white")
                ax_inset.tick_params(axis="y", colors="white")
                ax_inset.set_xlabel("Temps", fontsize=8, color="white")
                ax_inset.set_ylabel("Altitude (m)", fontsize=8, color="white")
                ax_inset.set_title(f"Zoom 0-{zoom_alt} m", fontsize=10, color="white")
                ax_inset.set_facecolor("#222222")

        # --- Sauvegarde ---
        img_name = "temporal_profile_by_level_heatmap"
        if zoom_alt is not None:
            img_name += f"_zoom{zoom_alt}"
        img_path = os.path.join(output_dir, f"{img_name}.png")
        plt.savefig(img_path, dpi=300)
        plt.close(fig)
        log_plot(f"Heatmap {'avec zoom ' if zoom_alt is not None else ''}enregistré dans {img_path}")

    # ========================================= SECTION LOG's =========================================

    def log_export_summary(self, output_path, tot_pts, start_time, description="JSON"):
        """Affiche un résumé coloré de l'export avec taille du fichier,
        nom du fichier ouytput et input et temps de traitement."""

        size_bytes = os.path.getsize(output_path)
        size_ko = size_bytes / 1024
        size_mo = size_bytes / (1024**2)
        size_go = size_bytes / (1024**3)
        filename_input = os.path.basename(self.input_path)
        duration = time.time() - start_time
        filename_output = os.path.basename(output_path)
        folder_output = os.path.dirname(output_path)

        if duration >= 60:
            minutes = int(duration // 60)
            seconds = int(duration % 60)
            time_str = f"{BOLD}{GREEN}{minutes}min {seconds}sec{RESET}"
        else:
            time_str = f"{BOLD}{GREEN}{duration:.2f}sec{RESET}"

        log_export(
            f"{description} : {folder_output}/{BOLD}{GREEN}{filename_output}{RESET}\n"
            f"Données brutes CAMS : {BOLD}{GREEN}{filename_input}{RESET}\n"
            f"Temps : {time_str} | "
            f"Points : {BOLD}{GREEN}{tot_pts}{RESET} | "
            f"Taille : {BOLD}{GREEN}{size_ko:.1f} ko ({size_mo:.2f} Mo | {size_go:.3f} Go){RESET}"
        )

    def export_figures(self, values, timestamps, output_path, cmap="viridis", ignore_nan=True, ignore_zeros=True):
        """Génère et sauvegarde des figures à partir des données fournies.

        Args:
            values: Valeurs à représenter.
            timestamps: Horodatages des valeurs.
            output_path (str): Chemin de sortie principal.
            cmap (str, optional): Colormap pour les graphiques (par défaut "viridis").
        """
        figures_dir = os.path.join(
            os.path.dirname(output_path),
            os.path.splitext(os.path.basename(output_path))[0] + "_figures",
        )
        self.plot_value_distribution(values, figures_dir)
        self.plot_temporal_profile(values, timestamps, figures_dir, ignore_nan, ignore_zeros)
        # self.plot_temporal_heatmap_by_level(figures_dir, zoom_alt=None, cmap=cmap)
        # self.plot_temporal_heatmap_by_level(figures_dir, zoom_alt=1000, cmap=cmap)
        print("\n")

    def save_as_json(self, data, output_path):
        """Sauvegarde des données au format JSON.

        Args:
            data (dict | list): Données à sauvegarder (dictionnaire ou liste sérialisable en JSON).
            output_path (str): Chemin complet du fichier JSON à créer.
        """
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f)

    # ========================================= SECTION JSON =========================================

    def to_json(self, output_path, interp_factor=None):
        """
        Extrait les données du NetCDF et les sauvegarde dans un fichier JSON.
        Peut appliquer une interpolation spatiale si interp_factor est un entier > 1.

        Args:
            output_path (str): Chemin de sauvegarde du fichier JSON.
            interp_factor (int or None, optional): Facteur d'interpolation spatiale
                (>1 pour densifier). None = pas d'interpolation.
        """
        start_time = time.time()
        log_separate("traitement en cours ...", color="green")
        log_export(f"Génération du JSON {'Interpolé' if interp_factor is not None else ''}...")

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Récupération des données
        data_var = self.get_data_var()
        lats = self.lats[:: self.step_lat]
        lons = self.lons[:: self.step_lon]
        lvls = self.lvls
        times = self.cesium_times
        n_times = len(times)

        # Tri des grilles si nécessaire
        if not np.all(np.diff(lats) > 0):
            lat_order = np.argsort(lats)
            lats = lats[lat_order]
            data_var = data_var[:, :, lat_order, :]

        if not np.all(np.diff(lons) > 0):
            lon_order = np.argsort(lons)
            lons = lons[lon_order]
            data_var = data_var[:, :, :, lon_order]

        # Grilles interpolées si nécessaire
        if interp_factor is not None and interp_factor > 1:
            interp_lats = np.linspace(lats.min(), lats.max(), len(lats) * interp_factor)
            interp_lons = np.linspace(lons.min(), lons.max(), len(lons) * interp_factor)
            do_interp = True
        else:
            interp_lats = lats
            interp_lons = lons
            do_interp = False

        positions = []
        values = []

        tot_pts = len(lvls) * len(interp_lats) * len(interp_lons)
        progress_bar = tqdm(total=tot_pts, desc="Traitement des points", unit="pt")

        # Boucle sur les niveaux
        for k, level in enumerate(lvls):
            alt = float(level) * (30 if do_interp else 20)

            if do_interp:
                # Interpolation par timestamp
                level_values_per_time = [[] for _ in range(n_times)]
                for t in range(n_times):
                    interpolator = RegularGridInterpolator(
                        (lats, lons), data_var[t, k], bounds_error=False, fill_value=np.nan
                    )
                    for lat in interp_lats:
                        for lon in interp_lons:
                            val = interpolator((lat, lon))
                            val_clean = float(val) if not np.isnan(val) else 0.0
                            level_values_per_time[t].append(val_clean)

                # Construction positions/values
                for idx_lat, lat in enumerate(interp_lats):
                    for idx_lon, lon in enumerate(interp_lons):
                        i = idx_lat * len(interp_lons) + idx_lon
                        positions.append([float(lon), float(lat), alt])
                        time_series = [level_values_per_time[t][i] for t in range(n_times)]
                        values.append(time_series)
                        progress_bar.update(1)

            else:
                # Pas d'interpolation : simple extraction
                for i, lat in enumerate(interp_lats):
                    for j, lon in enumerate(interp_lons):
                        positions.append([float(lon), float(lat), alt])
                        time_series = self.get_time_series(data_var, k, i, j)
                        cleaned_series = [float(v) if not np.isnan(v) else 0.0 for v in time_series]
                        values.append(cleaned_series)
                        progress_bar.update(1)

        progress_bar.close()

        # Création du dictionnaire JSON
        data = {
            "positions": positions,
            "values": values,
            "timestamps": times,
            "variable": getattr(self, "variable", None),
            "seuil": getattr(self, "seuil", None),
        }

        # Sauvegarde
        self.save_as_json(data, output_path)
        self.log_export_summary(
            output_path, tot_pts, start_time, description=f"JSON {'Interpolé' if do_interp else ''}"
        )
        self.export_figures(data["values"], data["timestamps"], output_path)

    def to_json_optimized(self, output_path, interp_factor=None, transform_epsg=None, scale_alt=1, threshold=None):
        """
        Extrait les données du NetCDF et les sauvegarde dans un JSON optimisé pour Cesium.
        Calcule les positions 3D, nettoie les séries temporelles et génère des timestamps
        raccourcis (start + step_seconds) si réguliers.

        Args:
            output_path (str): Chemin de sauvegarde du fichier JSON.
        """
        start_time = time.time()
        log_separate("\ntraitement en cours ...", color="green")
        log_export("Génération du JSON optimisé...")

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        data_var = self.get_data_var()

        transformer = None
        if transform_epsg:
            transformer = Transformer.from_crs(transform_epsg, "EPSG:4326", always_xy=True)

        positions = []
        values = []

        # Au début de la fonction, juste avant la boucle
        if hasattr(self, "lvls") and self.lvls is not None:
            levels = self.lvls
        elif hasattr(self, "altitudes") and self.altitudes is not None:
            levels = self.altitudes
        else:
            raise ValueError("Aucune variable de niveaux/altitudes trouvée dans l'objet.")

        # Gestion de l'interpolation
        lats = self.lats[:: self.step_lat]
        lons = self.lons[:: self.step_lon]

        do_interp = interp_factor is not None and interp_factor > 1
        if do_interp:
            interp_lats = np.linspace(lats.min(), lats.max(), len(lats) * interp_factor)
            interp_lons = np.linspace(lons.min(), lons.max(), len(lons) * interp_factor)
        else:
            interp_lats = lats
            interp_lons = lons

        tot_pts = len(levels) * len(self.lats[:: self.step_lat]) * len(self.lons[:: self.step_lon])
        progress_bar = tqdm(total=tot_pts, desc="Traitement des points", unit="pt")

        for k, level in enumerate(levels):
            alt = float(level) * scale_alt

            if do_interp:
                # Interpolation par timestamp
                level_values_per_time = [[] for _ in range(len(self.cesium_times))]
                for t in range(len(self.cesium_times)):
                    interpolator = RegularGridInterpolator(
                        (lats, lons), data_var[t, k], bounds_error=False, fill_value=np.nan
                    )
                    for lat in interp_lats:
                        for lon in interp_lons:
                            val = interpolator((lat, lon))
                            level_values_per_time[t].append(float(val) if not np.isnan(val) else 0.0)

                for idx_lat, lat in enumerate(interp_lats):
                    for idx_lon, lon in enumerate(interp_lons):
                        i = idx_lat * len(interp_lons) + idx_lon
                        if transform_epsg:
                            lon_wgs84, lat_wgs84 = transformer.transform(lon, lat)
                            positions.append([float(lon_wgs84), float(lat_wgs84), alt])
                        else:
                            positions.append([float(lon), float(lat), alt])

                        time_series = [level_values_per_time[t][i] for t in range(len(self.cesium_times))]
                        values.append(time_series)
                        progress_bar.update(1)

            else:
                for i, lat in enumerate(lats):
                    for j, lon in enumerate(lons):
                        if transform_epsg:
                            lon_wgs84, lat_wgs84 = transformer.transform(lon, lat)
                            positions.append([float(lon_wgs84), float(lat_wgs84), alt])
                        else:
                            positions.append([float(lon), float(lat), alt])
                        time_series = self.get_time_series(data_var, k, i, j)

                        cleaned_series = [float(v) if not np.isnan(v) else 0.0 for v in time_series]

                        values.append(cleaned_series)
                        progress_bar.update(1)

        progress_bar.close()

        # Si timestamps réguliers : start + step
        times = [datetime.fromisoformat(ts) for ts in self.cesium_times]
        step_sec = (times[1] - times[0]).total_seconds() if len(times) > 1 else 0
        start_iso = self.cesium_times[0]

        units = getattr(self.ds[self.variable], "units", None)

        # --- Filtrage des points : ne garder que le panache ---
        filtered_positions = []
        filtered_values = []

        for pos, series in zip(positions, values):
            # On s'assure que la série est un array pour faciliter les tests
            arr = np.array(series, dtype=float)

            # Vérifie si au moins une valeur est >= seuil
            if np.any(arr >= threshold):
                # On nettoie la série : valeurs < seuil, NaN, ou 0 -> 0.0
                cleaned = [float(v) if (not np.isnan(v) and v >= threshold) else 0.0 for v in arr]
                filtered_positions.append(pos)
                filtered_values.append(cleaned)

        # Remplace les listes initiales par les filtrées
        positions = filtered_positions
        values = filtered_values

        data = {
            "positions": positions,
            "values": values,
            "timestamps": {
                "start": start_iso,
                "step_seconds": step_sec,
                "count": len(times),
            },
            "variable": getattr(self, "variable", None),
            "seuil": threshold,
            "units": units,
        }

        timestamps_fig = data["timestamps"]
        if isinstance(timestamps_fig, dict):
            start_dt = datetime.fromisoformat(data["timestamps"]["start"])
            step = timedelta(seconds=timestamps_fig["step_seconds"])
            timestamps_fig = [(start_dt + i * step).isoformat() for i in range(timestamps_fig["count"])]

        self.save_as_json(data, output_path)
        self.log_export_summary(
            output_path,
            tot_pts,
            start_time,
            description=f"JSON Optimisé {'densifié' if do_interp else ''}",
        )
        self.export_figures(values, timestamps_fig, output_path, cmap=None, ignore_nan=True, ignore_zeros=True)

    # ========================================= SECTION CZML =========================================

    def interpolate_xy(self, data, method="linear", res=0.025):
        """Interpole les données sur une grille plus fine.

        Args:
            data (numpy.ndarray): Données 2D (lat, lon) à interpoler
            method (str): Méthode d'interpolation. Défaut sur 'linear'.
            res (float): Résolution de la grille interpolée (en degrés). Défaut à 0.025.

        Returns:
            tuple:
                - lat_new (numpy.ndarray): Tableau des latitudes de la nouvelle grille.
                - lon_new (numpy.ndarray): Tableau des longitudes de la nouvelle grille.
                - data_interp (numpy.ndarray): Données interpolées sur la grille (lat_new, lon_new).
        """
        lon_grid, lat_grid = np.meshgrid(self.lons, self.lats)

        # Points d'origine
        points = np.column_stack((lon_grid.ravel(), lat_grid.ravel()))
        values = data.values.ravel()

        # Nouvelle grille
        lon_new = np.arange(self.lons.min(), self.lons.max(), res)
        lat_new = np.arange(self.lats.min(), self.lats.max(), res)
        lon_new_grid, lat_new_grid = np.meshgrid(lon_new, lat_new)
        points_new = np.column_stack((lon_new_grid.ravel(), lat_new_grid.ravel()))

        # Interpolation
        data_interp = griddata(points, values, points_new, method=method)
        data_interp = data_interp.reshape(lat_new_grid.shape)

        return lat_new, lon_new, data_interp

    def to_json_serializable(self, val):
        """
        Convertit les types numpy et autres non JSON-serializable en types Python natifs.
        """
        if isinstance(val, np.generic):
            return val.item()
        elif isinstance(val, (np.ndarray, list, tuple)):
            return [self.to_json_serializable(v) for v in val]
        elif isinstance(val, dict):
            return {k: self.to_json_serializable(v) for k, v in val.items()}
        else:
            return val

    def to_czml(self, output_path, mode="2D", partitions=None, interpolate=False, res=None):
        """Exporte les données dans un fichier CZML compatible Cesium,
            avec option d'interpolation spatiale.

        Args:
            output_path (str): Chemin du fichier de sortie CZML.
            mode (str): Type de représentation, '2D' ou '3D'.
            partitions (int): Nombre de partitions pour les ellipsoïdes en 3D (8,16,32,64).
            interpolate (bool): Si True, applique une interpolation spatiale 2D.
            res (float): Résolution d'interpolation (si interpolate=True).
            smooth_sigma (tuple): Paramètres pour le lissage du volume interpolé.
        """
        start_time = time.time()
        print("\n" + "=" * 150)
        log_export(f"Génération du CZML{' interpolé' if interpolate else ''} en mode {mode}...")

        czml = [
            {
                "id": "document",
                "name": os.path.basename(output_path),
                "version": "1.0",
                "clock": {
                    "interval": f"{self.cesium_times[0]}/{self.cesium_times[-1]}",
                    "currentTime": self.cesium_times[0],
                    "multiplier": 27000,
                    "range": "LOOP_STOP",
                    "step": "SYSTEM_CLOCK_MULTIPLIER",
                },
            }
        ]

        tot_pts = len(self.lvls) * len(self.lats[:: self.step_lat]) * len(self.lons[:: self.step_lon])
        progress_bar = tqdm(total=tot_pts, desc="Traitement des points", unit="pt")

        for t_idx, time_iso in enumerate(self.cesium_times):
            slice_data = self.data_var.isel(time=t_idx)

            for k, level in enumerate(self.lvls):
                if interpolate:
                    lat_new, lon_new, data_grid = self.interpolate_xy(slice_data.isel(level=k), res=res)
                    data_grid = gaussian_filter(data_grid, sigma=(1, 1))
                else:
                    lat_new = self.lats[:: self.step_lat]
                    lon_new = self.lons[:: self.step_lon]
                    data_grid = slice_data.isel(
                        level=k,
                        latitude=slice(None, None, self.step_lat),
                        longitude=slice(None, None, self.step_lon),
                    ).values

                for i, lat in enumerate(lat_new):
                    for j, lon in enumerate(lon_new):
                        value = data_grid[i, j] if interpolate else data_grid[i, j]
                        if not np.isnan(value) and value > self.seuil:
                            radius = min(1000, max(500, value * 100))
                            z = float(level) * 20
                            position = [float(lon), float(lat), z]

                            czml_obj = {
                                "id": f"{self.variable}-{t_idx}-{position}",
                                "name": f"{float(value):.1f} {self.unit}",
                                "position": {"cartographicDegrees": position},
                                "availability": f"{time_iso}/{
                                    self.cesium_times[t_idx + 1] if t_idx + 1 < len(self.cesium_times) else time_iso
                                }",
                                "properties": {"value": self.to_json_serializable(float(value))},
                            }

                            if mode == "3D":
                                czml_obj["ellipsoid"] = {
                                    "radii": {"cartesian": [radius] * 3},
                                    "material": {"solidColor": {"color": {"rgba": [255, 255, 255, 100]}}},
                                    "slicePartitions": partitions,
                                    "stackPartitions": partitions,
                                }
                            else:
                                czml_obj["point"] = {
                                    "pixelSize": 10,
                                    "color": {"rgba": [255, 255, 255, 100]},
                                }

                            czml.append(czml_obj)

                        progress_bar.update(1)

        progress_bar.close()

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.to_json_serializable(czml), f, indent=2, ensure_ascii=False)

        self.log_export_summary(
            output_path,
            tot_pts,
            start_time,
            description=f"CZML{' interpolé' if interpolate else ''} {mode}",
        )
