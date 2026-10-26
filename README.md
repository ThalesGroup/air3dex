# Air3Dex

[Français](README.md) | [English](README.en.md)

Air3Dex convertit des données scientifiques géospatiales, puis les affiche dans
une interface web interactive de visualisation 3D basée sur Cesium.

Le projet comprend deux ensembles complémentaires :

- un pipeline Python de prétraitement des données NetCDF ;
- une interface web statique pour charger et explorer des fichiers JSON ou CZML.

## Fonctionnalités

- lecture de données CAMS, FAKE et NRBC ;
- conversion de fichiers NetCDF en JSON optimisé ;
- génération CZML selon le convertisseur utilisé ;
- visualisation 3D avec Cesium et minicarte Leaflet ;
- statistiques, graphiques, palettes et réglages de contraste ;
- architecture de lecteurs extensible dans `src/preprocessing/readers/`.

## Prérequis

### Interface web

- Node.js 20.19.0 ou une version ultérieure ;
- npm ;
- un navigateur récent avec WebGL activé ;
- un accès aux CDN et services cartographiques utilisés par l’interface.

### Configuration de Cesium Ion

Air3Dex nécessite un jeton d’accès Cesium Ion.

1. Créez un jeton depuis la documentation officielle de Cesium Ion.
2. Copiez le fichier de configuration d’exemple :

  ```bash
  cp src/air3dex/static/config.example.js src/air3dex/static/config.js
  ```
3. Renseignez cesiumIonToken dans config.js.

Le fichier config.js est ignoré par Git et ne doit pas être publié.

Un jeton utilisé par une application web reste visible dans le navigateur.
Il ne doit donc pas être considéré comme un secret. Pour un déploiement public, utilisez un jeton
dédié avec des permissions minimales et des restrictions d’URL.

### Prétraitement Python

- Python 3.11 ou une version ultérieure ;
- pip.

Ces versions correspondent aux contraintes déclarées par le projet.

## Démarrage rapide de l’interface

Depuis la racine du dépôt :

```bash
npm ci
npm start
```

Ouvrir ensuite :

```text
http://127.0.0.1:8000/
```

Le serveur local est fourni par `scripts/serve.mjs` et utilise uniquement les
modules intégrés à Node.js. Aucune extension Visual Studio Code et aucune
machine virtuelle ne sont nécessaires.

La procédure complète, notamment les contraintes liées aux CDN, à Cesium Ion
et au déploiement institutionnel, est disponible dans
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Installer le prétraitement Python

Créer de préférence un environnement virtuel :

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
```

Pour installer également les dépendances de test :

```bash
python -m pip install -e '.[dev]'
```

## Convertir un jeu de données

```bash
python src/preprocessing/convert_data_pipeline.py \
  --input CHEMIN_ENTREE.nc \
  --variable NOM_VARIABLE \
  --type cams \
  --output CHEMIN_SORTIE.json
```

Valeurs acceptées pour `--type` : `cams`, `fake` et `nrbc`.

Options disponibles :

- `--transform_epsg` : système de coordonnées source, par exemple `EPSG:2154` ;
- `--scale_alt` : facteur appliqué aux altitudes ;
- `--interp_factor` : facteur d’interpolation.

Voir le
[manuel utilisateur du prétraitement](docs/manuel_utilisateur_pretraitement.md)
pour le détail.

> **Défauts connus**
>
> L’export optimisé échoue actuellement lorsque le seuil n’est pas défini. Le
> facteur d’interpolation fourni par la ligne de commande est converti en
> nombre flottant alors que le traitement attend un nombre entier. Les tests
> documentent ces comportements en attendant leur correction.

## Qualité et tests

```bash
python -m pytest
npm run lint
```

## Architecture principale

```text
air3dex-project/
├── docs/
│   ├── DEPLOYMENT.md
│   └── manuel_utilisateur_pretraitement.md
├── scripts/
│   └── serve.mjs
├── src/
│   ├── air3dex/
│   │   ├── static/
│   │   └── templates/
│   │       └── index.html
│   └── preprocessing/
│       ├── convert_data_pipeline.py
│       ├── readers/
│       └── utils/
├── tests/
├── package.json
├── package-lock.json
├── pyproject.toml
└── requirements.txt
```

## Documentation

| Document | Objet |
|---|---|
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Installation npm, lancement local et déploiement |
| [manuel du prétraitement](docs/manuel_utilisateur_pretraitement.md) | Conversion des données |
| [English deployment guide](docs/DEPLOYMENT.en.md) | English deployment documentation |
| [English preprocessing guide](docs/manuel_utilisateur_pretraitement.en.md) | English data conversion documentation |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution au projet |
| [SECURITY.md](SECURITY.md) | Signalement des vulnérabilités |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Règles de la communauté |

## Configuration Cesium Ion

Air3Dex utilise actuellement le jeton public d’évaluation fourni avec CesiumJS.
Ce jeton n’est pas un secret propre au projet et sa présence dans le code ne
constitue pas une fuite d’identifiants. Il est cependant réservé aux essais et
aux démonstrations.

Pour un déploiement durable ou en production, configurer un jeton Cesium Ion
dédié, limité aux ressources nécessaires et restreint aux URL autorisées. Un
jeton utilisé par une application frontend reste observable par le navigateur :
sa protection repose sur ses permissions et ses restrictions.

## Contribution

Consulter [CONTRIBUTING.md](CONTRIBUTING.md) avant de proposer une modification.
Les évolutions doivent être documentées et accompagnées de tests adaptés.

## Licence

Air3Dex est distribué sous licence Apache 2.0. Voir [LICENSE.md](LICENSE.md).

## Auteurs

Voir [AUTHORS.md](AUTHORS.md).
