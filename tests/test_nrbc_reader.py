"""Tests unitaires du lecteur NRBC."""

import numpy as np
import xarray as xr

from readers.nrbc_reader import NRBCConverter


def test_get_data_var_subsamples_space_and_returns_float32():
    converter = NRBCConverter.__new__(NRBCConverter)
    values = np.arange(2 * 2 * 4 * 6).reshape(2, 2, 4, 6)
    converter.data_var = xr.DataArray(
        values,
        dims=("time", "altitude", "latitude", "longitude"),
    )
    converter.step_lat = 2
    converter.step_lon = 3

    result = converter.get_data_var()

    assert result.shape == (2, 2, 2, 2)
    assert result.dtype == np.float32
    np.testing.assert_array_equal(result, values[:, :, ::2, ::3].astype(np.float32))


def test_get_time_series_selects_one_spatial_cell():
    converter = NRBCConverter.__new__(NRBCConverter)
    values = np.arange(2 * 2 * 2 * 2).reshape(2, 2, 2, 2)

    np.testing.assert_array_equal(
        converter.get_time_series(values, alt_idx=1, lat_idx=1, lon_idx=0),
        values[:, 1, 1, 0],
    )
