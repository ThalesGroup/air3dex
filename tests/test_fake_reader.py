"""Tests unitaires du lecteur de données FAKE."""

import numpy as np
import xarray as xr

from readers.fake_reader import FAKEConverter


def test_get_data_var_subsamples_space_and_returns_float32():
    converter = FAKEConverter.__new__(FAKEConverter)
    values = np.arange(2 * 2 * 4 * 6).reshape(2, 2, 4, 6)
    converter.data_var = xr.DataArray(
        values,
        dims=("time", "height", "lat", "lon"),
    )
    converter.step_lat = 2
    converter.step_lon = 3

    result = converter.get_data_var()

    assert result.shape == (2, 2, 2, 2)
    assert result.dtype == np.float32
    np.testing.assert_array_equal(result, values[:, :, ::2, ::3].astype(np.float32))


def test_get_time_series_selects_one_spatial_cell():
    converter = FAKEConverter.__new__(FAKEConverter)
    values = np.arange(2 * 2 * 2 * 2).reshape(2, 2, 2, 2)

    np.testing.assert_array_equal(
        converter.get_time_series(values, lvl=0, lat=1, lon=1),
        values[:, 0, 1, 1],
    )
