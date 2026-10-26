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
générer des graphiques, et convertir les données en JSON.
"""

import numpy as np

from .netcdf_reader import NetCDFReader


class FAKEConverter(NetCDFReader):
    def __init__(self, input_path, variable, seuil, step_lat, step_lon):
        super().__init__(input_path, variable, seuil, step_lat, step_lon)

        self.unit = self.data_var.attrs.get("units", "SU")
        self.lons = self.ds["lon"].values
        self.lats = self.ds["lat"].values
        self.lvls = self.ds["height"].values
        self.times = self.ds["time"].values

        # Transposition dans le bon ordre du shape
        self.data_var = self.data_var.transpose("time", "height", "lat", "lon")

        self.start_date = self.ds.attrs.get("date_created")
        print("Start date :", self.start_date)
        self.cesium_times = self.compute_cesium_times()

    def get_data_var(self):
        # data shape: (time, level, lat, lon)
        data_var = self.data_var[:, :, :: self.step_lat, :: self.step_lon].values
        return data_var.astype(np.float32)

    def get_time_series(self, data_var, lvl, lat, lon):
        return data_var[:, lvl, lat, lon]


class FAKEConverter_2(NetCDFReader):
    def __init__(self, input_path, variable, seuil, step_lat, step_lon):
        super().__init__(input_path, variable, seuil, step_lat, step_lon)

        self.unit = self.data_var.attrs.get("units", "SU")
        self.lons = self.ds["lon"].values
        self.lats = self.ds["lat"].values
        self.lvls = self.ds["height"].values
        self.times = self.ds["time"].values

        self.start_date = self.ds.attrs.get("date_created")
        print("Start date :", self.start_date)
        self.cesium_times = self.compute_cesium_times()

    def get_data_var(self):
        # data shape: (time, level, lat, lon)
        data_var = self.data_var[:, :, :: self.step_lat, :: self.step_lon].values
        return data_var.astype(np.float32)

    def get_time_series(self, data_var, lvl, lat, lon):
        return data_var[:, lvl, lat, lon]
