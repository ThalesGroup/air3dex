# Air3Dex preprocessing user guide

[Français](manuel_utilisateur_pretraitement.md) | [English](manuel_utilisateur_pretraitement.en.md)

This document describes how to install and use the Python pipeline that
converts NetCDF files to optimized JSON for the Air3Dex interface.

## Requirements

- Python 3.11 or later;
- pip;
- a NetCDF file compatible with one of the available readers.

No specific editor or virtual machine is required.

## Install the preprocessing pipeline

From the repository root, create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
```

On Windows PowerShell, activate it with:

```powershell
.venv\Scripts\Activate.ps1
```

The module dependencies can also be installed directly:

```bash
python -m pip install -r src/preprocessing/requirements.txt
```

The first method is recommended because it uses the project metadata defined in
`pyproject.toml`.

## Module structure

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

- `convert_data_pipeline.py` provides the command-line entry point;
- `NetCDFReader` contains common processing operations;
- `CAMSConverter`, `FAKEConverter`, and `NRBCConverter` adapt the input logic to
  the supported data structures;
- `preprocess.py` contains a separate, earlier converter. Its role relative to
  the current readers still requires clarification from the maintainers.

The modular architecture is illustrated below:

![Modular preprocessing architecture](img/archi_modulaire_python.png)

## Display command-line help

From the repository root:

```bash
python src/preprocessing/convert_data_pipeline.py --help
```

## Convert a file

General syntax:

```bash
python src/preprocessing/convert_data_pipeline.py \
  --input INPUT_PATH.nc \
  --variable VARIABLE_NAME \
  --type DATA_TYPE \
  --output OUTPUT_PATH.json
```

CAMS example:

```bash
python src/preprocessing/convert_data_pipeline.py \
  --input data/input.nc \
  --variable pm10_conc \
  --type cams \
  --output data/output.json
```

The paths and variable name above are examples and must be replaced with values
that match the input file.

## Required arguments

| Argument | Description |
|---|---|
| `--input` | Path to the input NetCDF file |
| `--variable` | Exact name of the variable to extract |
| `--type` | Reader to use: `cams`, `fake`, or `nrbc` |
| `--output` | Path of the JSON file to generate |

The variable name must exist in the dataset. Otherwise, `xarray` raises an
error while initializing the converter.

## Optional arguments

| Argument | Description |
|---|---|
| `--transform_epsg` | Source coordinate reference system, for example `EPSG:2154` |
| `--scale_alt` | Scaling factor applied to levels or altitudes |
| `--interp_factor` | Spatial grid densification factor |

## Supported formats

### CAMS

The CAMS reader expects coordinates or dimensions including:

- `longitude`;
- `latitude`;
- `level`;
- `time`.

The initial date is read from the `ANALYSIS` attribute, then from `FORECAST`.
If neither is available, the first `time` value is used.

### FAKE

The test-data reader expects:

- `lon`;
- `lat`;
- `height`;
- `time`;
- the `date_created` dataset attribute.

The variable is transposed to `(time, height, lat, lon)` order.

### NRBC

The NRBC reader expects:

- `longitude`;
- `latitude`;
- `altitude`;
- `time`.

A missing `altitude` dimension explicitly raises an error.

## Generated JSON structure

The optimized export writes the following fields:

```json
{
  "positions": [],
  "values": [],
  "timestamps": {
    "start": "ISO_DATE",
    "step_seconds": 0,
    "count": 0
  },
  "variable": "VARIABLE_NAME",
  "seuil": 0,
  "units": "UNIT"
}
```

- `positions` contains longitude, latitude, and altitude triplets;
- `values` contains one time series per position;
- `timestamps` describes the start time, time step, and number of timestamps;
- `NaN` values are replaced with `0.0` during export.

The `seuil` field keeps its current French name because it is part of the JSON
format produced by the code.

## Known defects

Two behaviors are currently documented by tests:

1. `to_json_optimized()` fails when `threshold` is not provided, while the
   command-line entry point does not pass this argument;
2. `argparse` converts `--interp_factor` to a floating-point number, while the
   interpolation point count requires an integer.

The documentation must not hide these errors. The corresponding tests should
be replaced with functional tests when the defects are fixed.

## Run the tests

Install the development dependencies:

```bash
python -m pip install -e '.[dev]'
```

Then run:

```bash
python -m pytest
```

## Troubleshooting

### The `readers` module cannot be found

Run the script from the repository root using its complete path:

```bash
python src/preprocessing/convert_data_pipeline.py --help
```

### The requested variable cannot be found

Inspect the dataset with `xarray` and check the exact variable name. Names are
case-sensitive.

### The output file is not created

Check that:

- the input path exists;
- the output parent directory is writable;
- the dataset contains the dimensions expected by the selected reader;
- the complete error traceback has been reviewed.
