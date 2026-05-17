from __future__ import annotations

import enum


class VolumeUnit(str, enum.Enum):
    L = "L"
    GAL = "GAL"


class CountryCalcType(str, enum.Enum):
    PERCENT_TOTAL = "PERCENT_TOTAL"
    ACTUALS_CAPPED_TO_BENCHMARK = "ACTUALS_CAPPED_TO_BENCHMARK"
    ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT = "ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT"
    BENCHMARK_EX_VAT = "BENCHMARK_EX_VAT"

