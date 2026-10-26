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
Ce module contient des fonctions pour lire des fichiers CAMS de type NetCDF
pour pouvoir les convertir par la suite dans un autre format de fichier.
"""

import re

import numpy as np
import pandas as pd
from utils.logger import BOLD, MAGENTA, RESET, log_analyse

from .netcdf_reader import NetCDFReader


class CAMSConverter(NetCDFReader):
    """Convertisseur pour les fichiers NetCDF issus du modèle CAMS
    (Copernicus Atmosphere Monitoring Service).

    Hérite de NetCDFReader. Extrait les variables, les coordonnées spatio-temporelles,
    et prépare les données pour une exportation en JSON ou autre format de visualisation.
    """

    def __init__(self, input_path, variable, seuil, step_lat, step_lon):
        """Initialise un convertisseur CAMS à partir d'un fichier NetCDF.

        Args:
            input_path (str): Chemin du fichier NetCDF d'entrée.
            variable (str): Nom de la variable à extraire (ex : 'pm10_conc').
            seuil (float): Valeur seuil minimale à condiérer pour un filtrage éventuel.
            step_lat (int): Pas de sous-échantillonnage en latitude.
            step_lon (int): Pas de sous-échantillonnage en longitude.
        """
        super().__init__(input_path, variable, seuil, step_lat, step_lon)

        self.unit = self.data_var.attrs.get("units", "SU")
        self.lons = self.ds["longitude"].values
        self.lats = self.ds["latitude"].values
        self.lvls = self.ds["level"].values
        self.times = self.ds["time"].values

        self.start_date = self.extract_start_date()
        log_analyse(f"Start date : {BOLD}{MAGENTA}{self.start_date}{RESET}")
        self.cesium_times = self.compute_cesium_times()

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
        # analysis_string = self.ds.attrs.get("ANALYSIS", "")
        # print("ANALYSIS:", analysis_string)

        # Liste de clés possibles dans les attributs du NetCDF
        possible_keys = ["ANALYSIS", "FORECAST"]

        analysis_string = ""
        for key in possible_keys:
            if key in self.ds.attrs:
                analysis_string = str(self.ds.attrs[key])
                print(f"{key}:", analysis_string)
                break

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

    def get_data_var(self):
        """Extrait la variable de données principale du fichierNetCDF en sous-échantillonant
        selon les pas définis

        Returns:
            np.ndarray: Tableau 4D de type float32 avec les dimensions (time, level, lat, lon).
        """
        data_var = self.data_var[:, :, :: self.step_lat, :: self.step_lon].values
        return data_var.astype(np.float32)

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
        return data_var[:, lvl, lat, lon]
