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

from collections import defaultdict

import eccodes

# Chemin vers le fichier GRIB
grib_path = "/sf/preprocessing/input/grib/ENS_ANALYSIS_BA_020625_2_10_3.grib"

# Mapping manuel des paramId vers des noms de variables (à adapter si besoin)
param_map = {
    210120: "pm2p5",
    210121: "pm10",
    210001: "o3",
    # Ajoute d'autres mappings ici si nécessaire
}

# Dictionnaire pour organiser les messages GRIB
data = defaultdict(list)

print("\nExploration du fichier GRIB :")
with open(grib_path, "rb") as f:
    while True:
        try:
            gid = eccodes.codes_grib_new_from_file(f)
            if gid is None:
                break

            # Lire les champs utiles
            param_id = eccodes.codes_get_long(gid, "paramId") if eccodes.codes_is_defined(gid, "paramId") else -1
            short_name = param_map.get(param_id, f"param_{param_id}")
            level_type = (
                eccodes.codes_get_string(gid, "typeOfLevel")
                if eccodes.codes_is_defined(gid, "typeOfLevel")
                else "unknown"
            )
            level = eccodes.codes_get(gid, "level") if eccodes.codes_is_defined(gid, "level") else -1

            # Enregistrement dans le dictionnaire
            data[(short_name, level_type)].append(level)

            # Affichage debug
            print(
                f"Message GRIB → paramId: {param_id}, shortName: {short_name}, levelType: {level_type}, level: {level}"
            )

            eccodes.codes_release(gid)

        except eccodes.CodesInternalError as e:
            print(f"ECCODES error: {e}")
            break

# Affichage final
print("\nVariables détectées dans le fichier GRIB :")
for (short_name, level_type), levels in data.items():
    unique_levels = sorted(set(levels))
    print(f" - {short_name} @ {level_type} → niveaux : {unique_levels}")
