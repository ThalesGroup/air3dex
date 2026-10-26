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
Convertit des fichiers de données CAMS de type NetCDF en fichier JSON pour une visualisation
shader dans un environnement Cesium.
"""

import argparse

from readers.cams_reader import CAMSConverter
from readers.fake_reader import FAKEConverter
from readers.nrbc_reader import NRBCConverter


def main(
    input_path,
    variable,
    data_type,
    output_path,
    transform_epsg=None,
    scale_alt=None,
    interp_factor=None,
):
    """Convertit un fichier NetCDF en JSON selon le type de données.

    Args:
        input_path (str): Chemin du fichier NetCDF d'entrée.
        variable (str): Nom de la variable à extraire.
        data_type (str): Type de données en entrée ('cams', etc...).
        output_path (str): Chemin du fichier JSON de sortie.

    Raises:
        NotImplementedError: Si le type de données n'est pas reconnu.
    """
    if data_type == "cams":
        conv = CAMSConverter(input_path=input_path, variable=variable, seuil=0, step_lat=1, step_lon=1)
    elif data_type == "fake":
        conv = FAKEConverter(input_path=input_path, variable=variable, seuil=0, step_lat=1, step_lon=1)
    elif data_type == "nrbc":
        conv = NRBCConverter(input_path=input_path, variable=variable, seuil=0, step_lat=1, step_lon=1)
    else:
        raise NotImplementedError(f"Type inconnu : {data_type}")

    # Construire dynamiquement les kwargs
    kwargs = {}

    if transform_epsg is not None:
        kwargs["transform_epsg"] = transform_epsg

    if scale_alt is not None:
        kwargs["scale_alt"] = scale_alt

    if interp_factor is not None:
        kwargs["interp_factor"] = interp_factor

    # Appel générique
    conv.to_json_optimized(output_path, **kwargs)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert NetCDF to JSON")

    parser.add_argument("--input", required=True, help="Chemin du fichier NetCDF")
    parser.add_argument("--variable", required=True, help="Nom de la variable")
    parser.add_argument("--type", required=True, choices=["cams", "fake", "nrbc"])
    parser.add_argument("--output", required=True, help="Chemin du JSON de sortie")

    # Options facultatives
    parser.add_argument("--transform_epsg", required=False, help="Ex: EPSG:2154")
    parser.add_argument("--scale_alt", required=False, type=float, help="Facteur d'échelle altitude")
    parser.add_argument("--interp_factor", required=False, type=float, help="Facteur d'interpolation")

    args = parser.parse_args()

    main(
        input_path=args.input,
        variable=args.variable,
        data_type=args.type,
        output_path=args.output,
        transform_epsg=args.transform_epsg,
        scale_alt=args.scale_alt,
        interp_factor=args.interp_factor,
    )
