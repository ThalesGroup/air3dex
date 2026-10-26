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
Convertisseur pour fichiers NetCDF NRBC (u,v,w,tracer)
avec dimensions (time, altitude, latitude, longitude)
"""

import numpy as np
import pandas as pd
from utils.logger import BOLD, MAGENTA, RESET, log_analyse

from .netcdf_reader import NetCDFReader


class NRBCConverter(NetCDFReader):
    """Convertisseur pour fichiers NRBC."""

    def __init__(self, input_path, variable, seuil=0, step_lat=1, step_lon=1):
        """
        Args:
            input_path (str): Chemin du fichier NetCDF NRBC.
            variable (str): Nom de la variable à extraire ('U', 'V', 'W', 'tracer').
            seuil (float): Valeur seuil minimale pour filtrage éventuel.
            step_lat (int): Pas de sous-échantillonnage latitude.
            step_lon (int): Pas de sous-échantillonnage longitude.
        """
        super().__init__(input_path, variable, seuil, step_lat, step_lon)

        if "altitude" not in self.ds.dims:
            raise ValueError("Ce fichier ne contient pas de dimension 'altitude'")

        self.lons = self.ds["longitude"].values
        self.lats = self.ds["latitude"].values
        self.altitudes = self.ds["altitude"].values
        self.times = self.ds["time"].values

        self.unit = self.data_var.attrs.get("units", "SU")
        self.start_date = pd.to_datetime(self.times[0]).strftime("%Y-%m-%dT%H:%M:%S")
        log_analyse(f"Start date : {BOLD}{MAGENTA}{self.start_date}{RESET}")
        self.cesium_times = self.compute_cesium_times()

    def get_data_var(self):
        """Extrait la variable principale avec sous-échantillonnage sur lat/lon."""
        data_var = self.data_var[:, :, :: self.step_lat, :: self.step_lon].values
        return data_var.astype(np.float32)

    def get_time_series(self, data_var, alt_idx, lat_idx, lon_idx):
        """Retourne la série temporelle pour un point spécifique (altitude, lat, lon)."""
        return data_var[:, alt_idx, lat_idx, lon_idx]
