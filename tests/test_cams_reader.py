"""Tests unitaires du lecteur CAMS, sans fichier scientifique externe."""

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from readers.cams_reader import CAMSConverter


@pytest.mark.parametrize(
    ("attrs", "expected"),
    [
        ({"ANALYSIS": "20250625-20250626"}, "2025-06-25T00:00:00"),
        ({"FORECAST": "prévision 20250703"}, "2025-07-03T00:00:00"),
    ],
)
def test_extract_start_date_from_metadata(attrs, expected):
    converter = CAMSConverter.__new__(CAMSConverter)
    converter.ds = xr.Dataset(attrs=attrs)
    converter.times = np.array([np.datetime64("2025-01-01T06:00:00")])

    assert converter.extract_start_date() == expected


def test_extract_start_date_falls_back_to_first_time():
    converter = CAMSConverter.__new__(CAMSConverter)
    converter.ds = xr.Dataset()
    converter.times = np.array([np.datetime64("2025-02-04T06:30:00")])

    assert converter.extract_start_date() == "2025-02-04T06:30:00"


def test_get_data_var_subsamples_space_and_returns_float32():
    converter = CAMSConverter.__new__(CAMSConverter)
    values = np.arange(2 * 3 * 4 * 6).reshape(2, 3, 4, 6)
    converter.data_var = xr.DataArray(
        values,
        dims=("time", "level", "latitude", "longitude"),
    )
    converter.step_lat = 2
    converter.step_lon = 3

    result = converter.get_data_var()

    assert result.shape == (2, 3, 2, 2)
    assert result.dtype == np.float32
    np.testing.assert_array_equal(result, values[:, :, ::2, ::3].astype(np.float32))


def test_get_time_series_selects_one_spatial_cell():
    converter = CAMSConverter.__new__(CAMSConverter)
    values = np.arange(2 * 2 * 2 * 2).reshape(2, 2, 2, 2)

    np.testing.assert_array_equal(
        converter.get_time_series(values, lvl=1, lat=0, lon=1),
        values[:, 1, 0, 1],
    )
