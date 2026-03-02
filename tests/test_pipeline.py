import pytest
from climate_engine import ConfigManager

def test_config_dynamic_h3():
    cfg = ConfigManager.build()
    assert cfg.h3_col_name == "h3_09"
