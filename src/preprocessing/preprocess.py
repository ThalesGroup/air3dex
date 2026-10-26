#!/usr/bin/env python
#
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
Module de prétraitement de données géospatiales.

Ce module contient des fonctions pour lire des fichiers NetCDF,
générer des graphiques, et convertir les données en format CZML (2D/3D).
"""

import json
import os
import re
import time

import numpy as np
import pandas as pd
import xarray as xr
from scipy.interpolate import griddata
from scipy.ndimage import gaussian_filter
from tqdm import tqdm


class NetCDFConverter:
    """
    Classe pour convertir un fichier NetCDF 4D (longitude, latitude, niveau, temps)
    en différents formats exploitables pour la visualisation (CZML, JSON, GeoJSON).
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

        self.ds = xr.open_dataset(input_path)
        self.data_var = self.ds[variable]
        self.unit = self.data_var.attrs.get("units", "SU")
        self.lons = self.ds["longitude"].values
        self.lats = self.ds["latitude"].values
        self.lvls = self.ds["level"].values
        self.times = self.ds["time"].values
        self.start_date = self.extract_start_date()
        self.cesium_times = self.compute_cesium_times()
        self.val_min = float(np.nanmin(self.data_var))
        self.val_max = float(np.nanmax(self.data_var))

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
        analysis_string = self.ds.attrs.get("ANALYSIS", "")
        print("ANALYSIS:", analysis_string)

        # 1) Si deux dates "YYYYMMDD-YYYYMMDD", on prend la première
        m = re.search(r"(\d{8})-\d{8}", analysis_string)
        if m:
            return pd.to_datetime(m.group(1), format="%Y%m%d").strftime("%Y-%m-%dT%H:%M:%S")

        # 2) Sinon si une date unique "YYYYMMDD", on la prend
        m2 = re.search(r"(\d{8})", analysis_string)
        if m2:
            return pd.to_datetime(m2.group(1), format="%Y%m%d").strftime("%Y-%m-%dT%H:%M:%S")

        # 3) Sinon fallback sur self.times[0]
        t0 = self.times[0]
        if isinstance(t0, pd.Timestamp):
            dt = t0
        elif isinstance(t0, pd.Timedelta):
            # On suppose origine 1970‑01‑01 si ce sont des offsets
            dt = pd.Timestamp("1970-01-01") + t0
        else:
            # gère numpy.datetime64 et autres formats
            dt = pd.to_datetime(t0, errors="raise")

        return dt.strftime("%Y-%m-%dT%H:%M:%S")

    def compute_cesium_times(self):
        """Calcule les timestamps compatibles avec Cesium

        Returns:
            list: Liste de timestamps au format ISO
        """
        times = np.array([np.timedelta64(i, "h") for i in range(len(self.times))])
        t0 = pd.Timestamp(self.start_date)
        return [(t0 + pd.to_timedelta(t)).isoformat() + "Z" for t in times]

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

    def smooth_volume(self, volume_data, sigma=(1, 1)):
        """Applique un filtre gaussien 3D pour lisser les données interpolées.

        Args:
            volume_data (numpy.ndarray): ndarray de forme (lat, lon, lvl).
            sigma (tuple): Tuple de sigma pour chaque axe, contrôle le degré de lissage.
                Défaut à (1, 1).

        Returns:
            numpy.ndarray:  Volume de données lissé avec les mêmes dimensions que 'volume_data'.
        """
        smoothed = gaussian_filter(volume_data, sigma=sigma)
        return smoothed

    def to_czml(self, output_path, mode, partitions):
        """Exporte les données dans un fichier CZML compatible Cesium.

        Args:
            output_path (str): Chemin du fichier de sortie en CZML.
            mode (str): Choix du type de représentation, '2D' ou '3D'.
            partitions (int): Choix du partitionnement des sphères en mode '3D' (64, 32, 16 ou 8).
        """

        start_time = time.time()

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
                for i in range(0, len(self.lats), self.step_lat):
                    for j in range(0, len(self.lons), self.step_lon):
                        value = slice_data.isel(level=k, latitude=i, longitude=j).item()
                        if not np.isnan(value) and value > self.seuil:
                            radius = min(1000, max(500, value * 100))
                            position = [float(self.lons[j]), float(self.lats[i]), float(level) * 15]
                            czml_obj = {
                                "id": f"{self.variable}-{t_idx}-{position}",
                                "name": f"{value:.1f}{self.unit}",
                                "position": {"cartographicDegrees": position},
                                "availability": f"{time_iso}/{
                                    self.cesium_times[t_idx + 1] if t_idx + 1 < len(self.cesium_times) else time_iso
                                }",
                                "properties": {"value": value},
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
            json.dump(czml, f, indent=2, ensure_ascii=False)

        duration = time.time() - start_time
        if duration >= 60:
            minutes = int(duration // 60)
            seconds = int(duration % 60)
            print(f"[Export] Fichier {output_path} généré en {minutes}min {seconds}s")
            print(f"[Export] Fichier {output_path} généré en {duration:.2f}s")
        else:
            print(f"[Export] Fichier {output_path} généré en {duration:.2f}s")

    def to_czml_interp(self, output_path, mode, partitions):
        """Comme to_czml, mais applique une interpolation spatiale 2D avant export.

        Args:
            output_path (str): Chemin du fichier de sortie en CZML.
            mode (str): Choix du type de représentation, '2D' ou '3D'.
            partitions (int): Choix du partitionnement des sphères en mode '3D' (64, 32, 16 ou 8).
        """
        start_time = time.time()

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
                lat_new, lon_new, interp_data = self.interpolate_xy(slice_data.isel(level=k), res=0.025)
                interp_data = self.smooth_volume(interp_data, sigma=(1, 1))
                for i, lat in enumerate(lat_new):
                    for j, lon in enumerate(lon_new):
                        value = interp_data[i, j]
                        if not np.isnan(value) and value > self.seuil:
                            radius = min(1000, max(500, value * 100))
                            position = [float(lon), float(lat), float(level) * 30]
                            czml_obj = {
                                "id": f"{self.variable}-{t_idx}-{position}",
                                "name": f"{value:.1f} {self.unit}",
                                "position": {"cartographicDegrees": position},
                                "availability": f"{time_iso}/{
                                    self.cesium_times[t_idx + 1] if t_idx + 1 < len(self.cesium_times) else time_iso
                                }",
                                "properties": {"value": value},
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
            json.dump(czml, f, indent=2, ensure_ascii=False)

        duration = time.time() - start_time
        if duration >= 60:
            minutes = int(duration // 60)
            seconds = int(duration % 60)
            print(f"[Export] Fichier {output_path} généré en {minutes}min {seconds}s")
            print(f"[Export] Fichier {output_path} généré en {duration:.2f}s")
        else:
            print(f"[Export] Fichier {output_path} généré en {duration:.2f}s")


# Exemple d'utilisation
if __name__ == "__main__":
    conv = NetCDFConverter(
        input_path="/sf/preprocessing/input/netcdf/ENS_ANALYSIS_BA_120722_1_10_2.nc",
        variable="pm10_conc",
        seuil=1,
        step_lat=1,
        step_lon=1,
    )

    # Export en CZML 3D/2D
    PARTITIONS = 8
    FILENAME_2D = "/sf/preprocessing/output/2dCZML/ba/output_ba_pm10.czml"
    FILENAME_3D = "/sf/preprocessing/output/3dCZML/alpes/output_alpes_pm10_part{PARTITIONS}.czml"

    FILENAME_3D_INTERP = (
        f"/sf/preprocessing/output/3dCZML/alpes/interpCZML/output_interpXY3d_alpes_pm10_part{PARTITIONS}_025.czml"
    )

    # conv.to_czml(FILENAME_2D, mode="2D", partitions=PARTITIONS)

    # conv.to_czml_interp(FILENAME_2D, mode="2D", partitions=PARTITIONS)

    # ENS_ANALYSIS_BA_120722_1_10_2.nc
    # ENS_ANALYSIS_BA_120722_3_10_4.nc
    # ENS_ANALYSIS_ALPES_010525_1_10_3.nc
