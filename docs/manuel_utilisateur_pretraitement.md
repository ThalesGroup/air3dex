# Manuel utilisateur du prétraitement Air3Dex

[Français](manuel_utilisateur_pretraitement.md) | [English](manuel_utilisateur_pretraitement.en.md)

Ce document décrit l’installation et l’utilisation du pipeline Python qui
convertit des fichiers NetCDF en JSON optimisé pour l’interface Air3Dex.

## Prérequis

- Python 3.11 ou une version ultérieure ;
- pip ;
- un fichier NetCDF compatible avec l’un des lecteurs disponibles.

Aucun éditeur particulier et aucune machine virtuelle ne sont requis.

## Installer le prétraitement

Depuis la racine du dépôt, créer puis activer un environnement virtuel :

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
```

Sous Windows PowerShell, l’activation s’effectue avec :

```powershell
.venv\Scripts\Activate.ps1
```

Une installation directe des dépendances du module reste possible :

```bash
python -m pip install -r src/preprocessing/requirements.txt
```

La première méthode est recommandée : elle s’appuie sur les métadonnées du
projet définies dans `pyproject.toml`.

## Architecture du module

```text
src/preprocessing/
├── convert_data_pipeline.py
├── preprocess.py
├── readers/
│   ├── __init__.py
│   ├── cams_reader.py
│   ├── fake_reader.py
│   ├── netcdf_reader.py
│   └── nrbc_reader.py
└── utils/
    └── logger.py
```

- `convert_data_pipeline.py` fournit le point d’entrée en ligne de commande ;
- `NetCDFReader` rassemble les traitements communs ;
- `CAMSConverter`, `FAKEConverter` et `NRBCConverter` adaptent la lecture aux
  structures de données prises en charge ;
- `preprocess.py` contient un convertisseur antérieur distinct. Son rôle par
  rapport aux lecteurs actuels doit encore être clarifié par les mainteneurs.

L’architecture modulaire est illustrée ici :

![Architecture modulaire du prétraitement](img/archi_modulaire_python.png)

## Afficher l’aide

Depuis la racine du dépôt :

```bash
python src/preprocessing/convert_data_pipeline.py --help
```

## Convertir un fichier

Syntaxe générale :

```bash
python src/preprocessing/convert_data_pipeline.py \
  --input CHEMIN_ENTREE.nc \
  --variable NOM_VARIABLE \
  --type TYPE_DONNEES \
  --output CHEMIN_SORTIE.json
```

Exemple CAMS :

```bash
python src/preprocessing/convert_data_pipeline.py \
  --input data/input.nc \
  --variable pm10_conc \
  --type cams \
  --output data/output.json
```

Les chemins et le nom de variable ci-dessus sont des exemples : ils doivent
être remplacés par ceux du fichier traité.

## Paramètres obligatoires

| Paramètre | Description |
|---|---|
| `--input` | Chemin du fichier NetCDF d’entrée |
| `--variable` | Nom exact de la variable à extraire |
| `--type` | Lecteur à utiliser : `cams`, `fake` ou `nrbc` |
| `--output` | Chemin du fichier JSON à générer |

Le nom de variable doit exister dans le dataset. Sinon, `xarray` lève une
erreur lors de l’ouverture du convertisseur.

## Paramètres facultatifs

| Paramètre | Description |
|---|---|
| `--transform_epsg` | Système de coordonnées source, par exemple `EPSG:2154` |
| `--scale_alt` | Facteur multiplicatif appliqué aux niveaux ou altitudes |
| `--interp_factor` | Facteur de densification de la grille spatiale |

## Formats pris en charge

### CAMS

Le lecteur CAMS attend notamment les coordonnées ou dimensions suivantes :

- `longitude` ;
- `latitude` ;
- `level` ;
- `time`.

La date initiale est recherchée dans les attributs `ANALYSIS`, puis `FORECAST`.
À défaut, le premier élément de `time` est utilisé.

### FAKE

Le lecteur de données de test attend :

- `lon` ;
- `lat` ;
- `height` ;
- `time` ;
- l’attribut de dataset `date_created`.

La variable est transposée dans l’ordre `(time, height, lat, lon)`.

### NRBC

Le lecteur NRBC attend :

- `longitude` ;
- `latitude` ;
- `altitude` ;
- `time`.

L’absence de dimension `altitude` provoque explicitement une erreur.

## Structure du JSON produit

L’export optimisé écrit les champs suivants :

```json
{
  "positions": [],
  "values": [],
  "timestamps": {
    "start": "DATE_ISO",
    "step_seconds": 0,
    "count": 0
  },
  "variable": "NOM_VARIABLE",
  "seuil": 0,
  "units": "UNITE"
}
```

- `positions` contient les triplets longitude, latitude et altitude ;
- `values` contient une série temporelle par position ;
- `timestamps` décrit le début, le pas temporel et le nombre d’instants ;
- les valeurs `NaN` sont remplacées par `0.0` pendant l’export.

## Défauts connus

Deux comportements sont actuellement documentés par les tests :

1. `to_json_optimized()` échoue lorsque `threshold` n’est pas renseigné, alors
   que le point d’entrée ne lui transmet pas ce paramètre ;
2. `--interp_factor` est converti en nombre flottant par `argparse`, tandis que
   le calcul du nombre de points d’interpolation requiert un entier.

Ces erreurs ne doivent pas être masquées dans la documentation. Les tests
correspondants devront être remplacés par des tests fonctionnels lorsque les
correctifs seront implémentés.

## Exécuter les tests

Installer les dépendances de développement :

```bash
python -m pip install -e '.[dev]'
```

Puis lancer :

```bash
python -m pytest
```

## Dépannage

### Le module `readers` est introuvable

Exécuter le script depuis la racine du dépôt avec son chemin complet :

```bash
python src/preprocessing/convert_data_pipeline.py --help
```

### La variable demandée est introuvable

Afficher le contenu du dataset avec `xarray` et vérifier le nom exact de la
variable. La casse est significative.

### Le fichier de sortie n’est pas créé

Vérifier :

- que le chemin d’entrée existe ;
- que le répertoire parent de sortie est accessible en écriture ;
- que le dataset contient les dimensions attendues par le lecteur choisi ;
- la trace d’erreur complète affichée dans le terminal.
