# Air3Dex

[Français](README.md) | [English](README.en.md)

Air3Dex converts scientific geospatial data and displays it in an interactive
Cesium-based 3D web interface.

The project consists of two complementary components:

- a Python pipeline for preprocessing NetCDF data;
- a static web interface for loading and exploring JSON or CZML files.

## Features

- CAMS, FAKE, and NRBC data readers;
- conversion of NetCDF files to optimized JSON;
- CZML generation, depending on the selected converter;
- 3D visualization with Cesium and a Leaflet minimap;
- statistics, charts, color palettes, and contrast controls;
- an extensible reader architecture in `src/preprocessing/readers/`.

## Requirements

### Web interface

- Node.js 20.19.0 or later;
- npm;
- a recent browser with WebGL enabled;
- access to the CDNs and mapping services used by the interface.


### Cesium Ion configuration

Air3Dex requires a Cesium Ion access token.

1. Create an access token by following the
   [official Cesium Ion documentation](https://cesium.com/learn/ion/cesium-ion-access-tokens/).

2. Copy the example configuration file:

  ```bash
  cp src/air3dex/static/config.example.js src/air3dex/static/config.js
  ```

3. Set `cesiumIonToken` in `config.js`:

  ```js
  globalThis.AIR3DEX_CONFIG = {
     cesiumIonToken: "YOUR_CESIUM_ION_ACCESS_TOKEN",
  };
  ```

The `config.js` file is excluded from version control and must not be
committed or published.

A token used by a browser-based application remains visible to its users
and must therefore not be treated as a secret. For public or production
deployments, use a dedicated token with minimal permissions and appropriate
URL restrictions.


### Python preprocessing

- Python 3.11 or later;
- pip.

These versions match the constraints declared by the project.

## Web interface quick start

From the repository root:

```bash
npm ci
npm start
```

Then open:

```text
http://127.0.0.1:8000/
```

The local server is implemented in `scripts/serve.mjs` and only uses built-in
Node.js modules. No Visual Studio Code extension or virtual machine is required.

The complete procedure, including CDN, Cesium Ion, and institutional deployment
considerations, is available in
[docs/DEPLOYMENT.en.md](docs/DEPLOYMENT.en.md).

## Install the Python preprocessing pipeline

Using a virtual environment is recommended:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
```

To install the test dependencies as well:

```bash
python -m pip install -e '.[dev]'
```

## Convert a dataset

```bash
python src/preprocessing/convert_data_pipeline.py \
  --input INPUT_PATH.nc \
  --variable VARIABLE_NAME \
  --type cams \
  --output OUTPUT_PATH.json
```

Accepted values for `--type` are `cams`, `fake`, and `nrbc`.

Available options:

- `--transform_epsg`: source coordinate reference system, for example
  `EPSG:2154`;
- `--scale_alt`: scaling factor applied to altitudes;
- `--interp_factor`: interpolation factor.

See the [preprocessing user guide](docs/manuel_utilisateur_pretraitement.en.md)
for details.

> **Known defects**
>
> The optimized export currently fails when no threshold is defined. The
> interpolation factor received from the command line is converted to a
> floating-point number while the processing code expects an integer. Tests
> document both behaviors until they are fixed.

## Quality checks and tests

```bash
python -m pytest
npm run lint
```

## Main project structure

```text
air3dex-project/
├── docs/
│   ├── DEPLOYMENT.md
│   ├── DEPLOYMENT.en.md
│   ├── manuel_utilisateur_pretraitement.md
│   └── manuel_utilisateur_pretraitement.en.md
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

| Document | Purpose |
|---|---|
| [DEPLOYMENT.en.md](docs/DEPLOYMENT.en.md) | npm installation, local server, and deployment |
| [Preprocessing user guide](docs/manuel_utilisateur_pretraitement.en.md) | Data conversion |
| [French README](README.md) | French project overview |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards |

## Cesium Ion configuration

Air3Dex currently uses the public evaluation token supplied with CesiumJS. This
token is not a project-specific secret, and storing it in the source code does
not constitute a credential leak. It is intended for evaluation and
demonstration purposes only.

For long-term or production deployment, configure a dedicated Cesium Ion token
with access limited to the required resources and the authorized URLs. A token
used by a frontend application remains visible to the browser, so its protection
relies on its permissions and restrictions.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. New features
must be documented and covered by appropriate tests.

## License

Air3Dex is distributed under the Apache License 2.0. See
[LICENSE.md](LICENSE.md).

## Authors

See [AUTHORS.md](AUTHORS.md).
