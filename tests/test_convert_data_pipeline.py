"""Tests du point d'entrée de conversion."""

from unittest.mock import Mock

import pytest

import convert_data_pipeline


@pytest.mark.parametrize(
    ("data_type", "converter_name"),
    [
        ("cams", "CAMSConverter"),
        ("fake", "FAKEConverter"),
        ("nrbc", "NRBCConverter"),
    ],
)
def test_main_selects_expected_converter(monkeypatch, data_type, converter_name):
    converter = Mock()
    converter_class = Mock(return_value=converter)
    monkeypatch.setattr(convert_data_pipeline, converter_name, converter_class)

    convert_data_pipeline.main("input.nc", "tracer", data_type, "output.json")

    converter_class.assert_called_once_with(
        input_path="input.nc",
        variable="tracer",
        seuil=0,
        step_lat=1,
        step_lon=1,
    )
    converter.to_json_optimized.assert_called_once_with("output.json")


def test_main_rejects_unknown_data_type():
    with pytest.raises(NotImplementedError, match="Type inconnu : inconnu"):
        convert_data_pipeline.main("input.nc", "tracer", "inconnu", "output.json")


def test_main_forwards_optional_export_arguments(monkeypatch):
    converter = Mock()
    monkeypatch.setattr(
        convert_data_pipeline,
        "CAMSConverter",
        Mock(return_value=converter),
    )

    convert_data_pipeline.main(
        "input.nc",
        "tracer",
        "cams",
        "output.json",
        transform_epsg="EPSG:2154",
        scale_alt=2.5,
        interp_factor=2.0,
    )

    converter.to_json_optimized.assert_called_once_with(
        "output.json",
        transform_epsg="EPSG:2154",
        scale_alt=2.5,
        interp_factor=2.0,
    )
