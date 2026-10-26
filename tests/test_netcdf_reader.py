"""Tests des comportements communs aux lecteurs NetCDF."""

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from readers.netcdf_reader import NetCDFReader


@pytest.mark.parametrize(
    ("times", "expected"),
    [
        (
            np.array(
                [
                    np.datetime64("2025-06-25T00:00:00"),
                    np.datetime64("2025-06-25T01:00:00"),
                ]
            ),
            ["2025-06-25T00:00:00Z", "2025-06-25T01:00:00Z"],
        ),
        (
            [pd.Timedelta(hours=0), pd.Timedelta(hours=2)],
            ["2025-06-25T00:00:00Z", "2025-06-25T02:00:00Z"],
        ),
    ],
)
def test_compute_cesium_times(times, expected):
    reader = NetCDFReader.__new__(NetCDFReader)
    reader.start_date = "2025-06-25T00:00:00"
    reader.times = times

    assert reader.compute_cesium_times() == expected


def _minimal_reader_for_export():
    reader = NetCDFReader.__new__(NetCDFReader)
    reader.input_path = "input.nc"
    reader.variable = "tracer"
    reader.seuil = 0
    reader.step_lat = 1
    reader.step_lon = 1
    reader.lats = np.array([45.0, 46.0])
    reader.lons = np.array([2.0, 3.0])
    reader.lvls = np.array([100.0])
    reader.altitudes = None
    reader.cesium_times = ["2025-06-25T00:00:00", "2025-06-25T01:00:00"]
    reader.ds = xr.Dataset(
        {"tracer": (("time", "level", "latitude", "longitude"), np.ones((2, 1, 2, 2)))},
    )
    reader.get_data_var = lambda: np.ones((2, 1, 2, 2), dtype=np.float32)
    reader.get_time_series = lambda data, level, lat, lon: data[:, level, lat, lon]
    return reader


def test_optimized_export_currently_fails_without_threshold(tmp_path):
    """Documente le défaut connu ; à remplacer par un test fonctionnel après correction."""
    reader = _minimal_reader_for_export()

    with pytest.raises(TypeError):
        reader.to_json_optimized(str(tmp_path / "output.json"))


def test_optimized_export_currently_rejects_float_interpolation_factor(tmp_path):
    """Documente le défaut connu de la valeur float fournie par argparse."""
    reader = _minimal_reader_for_export()

    with pytest.raises(TypeError):
        reader.to_json_optimized(
            str(tmp_path / "output.json"),
            interp_factor=2.0,
            threshold=0,
        )
