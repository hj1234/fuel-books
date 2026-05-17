from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import CountryCalcType
from app.models.fuel_benchmark_price import FuelBenchmarkPrice
from app.models.fuel_expense import FuelExpense
from app.models.aircraft_fuel_policy import AircraftFuelPolicy
from app.models.fuel_policy import FuelPolicy, FuelPolicyCountryRate
from app.services.fx import quote_fx


GAL_TO_L = Decimal("3.785411784")


@dataclass(frozen=True)
class RefundResult:
    effective_date: date
    refund_amount: Decimal
    refund_currency: str
    derivation: str
    explanation: str
    details: dict[str, Any] | None = None


def _nearest_policy_rate(db: Session, *, policy_id: int, country_code: str, on_date: date) -> FuelPolicyCountryRate | None:
    return db.scalar(
        select(FuelPolicyCountryRate)
        .where(
            FuelPolicyCountryRate.policy_id == policy_id,
            FuelPolicyCountryRate.country_code == country_code,
            FuelPolicyCountryRate.effective_from <= on_date,
        )
        .order_by(FuelPolicyCountryRate.effective_from.desc())
        .limit(1)
    )


def _select_applicable_rate(db: Session, *, policy_id: int, country_code: str, on_date: date) -> FuelPolicyCountryRate | None:
    # Exact match first, else ROW fallback
    cc = country_code.upper()
    return _nearest_policy_rate(db, policy_id=policy_id, country_code=cc, on_date=on_date) or _nearest_policy_rate(
        db, policy_id=policy_id, country_code="ROW", on_date=on_date
    )


def _volume_liters(expense: FuelExpense) -> Decimal:
    vol = Decimal(str(expense.volume))
    if expense.unit.upper() == "L":
        return vol
    if expense.unit.upper() == "GAL":
        return vol * GAL_TO_L
    raise ValueError(f"Unsupported volume unit {expense.unit}")


def _convert(db: Session, *, amount: Decimal, from_ccy: str, to_ccy: str, on_date: date) -> tuple[Decimal, date, str]:
    if from_ccy.upper() == to_ccy.upper():
        return amount, on_date, "IDENTITY"
    q = quote_fx(db, base_currency=from_ccy, quote_currency=to_ccy, on_date=on_date)
    return amount * q.rate, q.effective_date, q.derivation


def _convert_detailed(
    db: Session, *, amount: Decimal, from_ccy: str, to_ccy: str, on_date: date
) -> tuple[Decimal, date, str, dict[str, Any]]:
    if from_ccy.upper() == to_ccy.upper():
        return amount, on_date, "IDENTITY", {"type": "IDENTITY", "rate": 1.0, "effective_date": on_date.isoformat()}
    q = quote_fx(db, base_currency=from_ccy, quote_currency=to_ccy, on_date=on_date)
    return (
        amount * q.rate,
        q.effective_date,
        q.derivation,
        {"type": "FX", "base_currency": from_ccy.upper(), "quote_currency": to_ccy.upper(), "rate": float(q.rate), "effective_date": q.effective_date.isoformat(), "derivation": q.derivation},
    )


def _benchmark_price(
    db: Session, *, policy_id: int, airfield_code: str, includes_vat: bool, on_date: date
) -> FuelBenchmarkPrice | None:
    return db.scalar(
        select(FuelBenchmarkPrice)
        .where(
            FuelBenchmarkPrice.policy_id == policy_id,
            FuelBenchmarkPrice.airfield_code == airfield_code,
            FuelBenchmarkPrice.includes_vat == includes_vat,
            FuelBenchmarkPrice.effective_from <= on_date,
        )
        .order_by(FuelBenchmarkPrice.effective_from.desc())
        .limit(1)
    )


@dataclass(frozen=True)
class _BenchResolved:
    currency: str
    price_per_unit: Decimal
    effective_from: date
    includes_vat: bool
    vat_rate: Decimal
    derived: bool


def _resolve_benchmark_price(
    db: Session, *, policy_id: int, airfield_code: str, includes_vat: bool, on_date: date
) -> _BenchResolved:
    """
    If the requested includes_vat row doesn't exist, derive it from the opposite using vat_rate:
    - ex = inc / (1 + vat_rate)
    - inc = ex * (1 + vat_rate)
    """
    direct = _benchmark_price(db, policy_id=policy_id, airfield_code=airfield_code, includes_vat=includes_vat, on_date=on_date)
    if direct:
        return _BenchResolved(
            currency=direct.currency.upper(),
            price_per_unit=Decimal(str(direct.price_per_unit)),
            effective_from=direct.effective_from,
            includes_vat=direct.includes_vat,
            vat_rate=Decimal(str(direct.vat_rate)),
            derived=False,
        )

    other = _benchmark_price(db, policy_id=policy_id, airfield_code=airfield_code, includes_vat=not includes_vat, on_date=on_date)
    if not other:
        raise ValueError("No benchmark price found for airfield/date (neither inc-VAT nor ex-VAT)")

    vat_rate = Decimal(str(other.vat_rate))
    factor = Decimal("1") + vat_rate
    other_price = Decimal(str(other.price_per_unit))
    if includes_vat:
        price = other_price * factor
    else:
        price = other_price / factor

    return _BenchResolved(
        currency=other.currency.upper(),
        price_per_unit=price,
        effective_from=other.effective_from,
        includes_vat=includes_vat,
        vat_rate=vat_rate,
        derived=True,
    )


def calculate_refund(db: Session, *, expense: FuelExpense) -> RefundResult:
    mapping = db.scalar(select(AircraftFuelPolicy).where(AircraftFuelPolicy.aircraft_id == expense.aircraft_id))
    policy = db.get(FuelPolicy, mapping.fuel_policy_id) if mapping else None
    if not policy:
        raise ValueError("No fuel policy configured for aircraft")

    on_date = expense.purchased_at.date()
    rate_row = _select_applicable_rate(db, policy_id=policy.id, country_code=expense.country_code, on_date=on_date)
    if not rate_row:
        raise ValueError("No applicable fuel policy rule found (no country match and no ROW)")

    policy_ccy = policy.base_currency.upper()
    exp_ccy = expense.currency.upper()

    total = Decimal(str(expense.total_amount))
    vat = Decimal(str(expense.vat_amount)) if expense.vat_amount is not None else Decimal("0")

    # VAT handling: if not reimbursed, treat actual reimbursable as ex-VAT
    actual_reimbursable = total if rate_row.reimburse_vat else (total - vat)

    actual_in_policy, fx_date_actual, fx_derivation_actual = _convert(
        db, amount=actual_reimbursable, from_ccy=exp_ccy, to_ccy=policy_ccy, on_date=on_date
    )

    if rate_row.calc_type == CountryCalcType.PERCENT_TOTAL:
        if rate_row.percent_rate is None:
            raise ValueError("percent_rate is required for PERCENT_TOTAL")
        refund = actual_in_policy * Decimal(str(rate_row.percent_rate))
        return RefundResult(
            effective_date=fx_date_actual,
            refund_amount=refund,
            refund_currency=policy_ccy,
            derivation=f"PERCENT_TOTAL({fx_derivation_actual})",
            explanation="Percent of actuals",
        )

    if not rate_row.benchmark_airfield_code:
        raise ValueError("benchmark_airfield_code is required for benchmark-based rules")
    multiplier = Decimal(str(rate_row.benchmark_multiplier)) if rate_row.benchmark_multiplier is not None else Decimal("1")

    liters = _volume_liters(expense)

    # Benchmark selection: for ex-VAT rules always use includes_vat=False,
    # otherwise follow reimburse_vat (GB uses inc-VAT benchmark).
    if rate_row.calc_type in {CountryCalcType.BENCHMARK_EX_VAT, CountryCalcType.ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT}:
        benchmark_includes_vat = False
    else:
        benchmark_includes_vat = bool(rate_row.reimburse_vat)

    bench = _resolve_benchmark_price(
        db,
        policy_id=policy.id,
        airfield_code=rate_row.benchmark_airfield_code,
        includes_vat=benchmark_includes_vat,
        on_date=on_date,
    )

    bench_total = liters * bench.price_per_unit
    bench_total_policy, fx_date_bench, fx_derivation_bench = _convert(
        db, amount=bench_total, from_ccy=bench.currency, to_ccy=policy_ccy, on_date=on_date
    )
    bench_cap = bench_total_policy * multiplier

    if rate_row.calc_type == CountryCalcType.BENCHMARK_EX_VAT:
        return RefundResult(
            effective_date=min(fx_date_actual, fx_date_bench),
            refund_amount=bench_total_policy,
            refund_currency=policy_ccy,
            derivation=f"BENCHMARK_EX_VAT({fx_derivation_bench})",
            explanation="Benchmark ex VAT",
        )

    if rate_row.calc_type in {CountryCalcType.ACTUALS_CAPPED_TO_BENCHMARK, CountryCalcType.ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT}:
        refund = actual_in_policy if actual_in_policy <= bench_cap else bench_cap
        return RefundResult(
            effective_date=min(fx_date_actual, fx_date_bench),
            refund_amount=refund,
            refund_currency=policy_ccy,
            derivation=f"MIN(ACTUAL({fx_derivation_actual}),BENCH*{multiplier}({fx_derivation_bench}))",
            explanation="Actuals capped to benchmark",
        )

    raise ValueError(f"Unsupported calc_type {rate_row.calc_type}")


def calculate_refund_detailed(db: Session, *, expense: FuelExpense) -> RefundResult:
    """
    Same calculation as calculate_refund(), but returns a structured breakdown so the frontend
    can reproduce the decision path and arithmetic.
    """
    mapping = db.scalar(select(AircraftFuelPolicy).where(AircraftFuelPolicy.aircraft_id == expense.aircraft_id))
    policy = db.get(FuelPolicy, mapping.fuel_policy_id) if mapping else None
    if not policy:
        raise ValueError("No fuel policy configured for aircraft")

    on_date = expense.purchased_at.date()
    rate_row = _select_applicable_rate(db, policy_id=policy.id, country_code=expense.country_code, on_date=on_date)
    if not rate_row:
        raise ValueError("No applicable fuel policy rule found (no country match and no ROW)")

    policy_ccy = policy.base_currency.upper()
    exp_ccy = expense.currency.upper()

    total = Decimal(str(expense.total_amount))
    vat = Decimal(str(expense.vat_amount)) if expense.vat_amount is not None else Decimal("0")
    actual_reimbursable = total if rate_row.reimburse_vat else (total - vat)

    actual_in_policy, fx_date_actual, fx_derivation_actual, fx_actual_details = _convert_detailed(
        db, amount=actual_reimbursable, from_ccy=exp_ccy, to_ccy=policy_ccy, on_date=on_date
    )

    details: dict[str, Any] = {
        "as_of_date": on_date.isoformat(),
        "policy": {"id": policy.id, "base_currency": policy_ccy},
        "rate_rule": {
            "id": rate_row.id,
            "country_code": rate_row.country_code,
            "effective_from": rate_row.effective_from.isoformat(),
            "calc_type": str(rate_row.calc_type),
            "reimburse_vat": bool(rate_row.reimburse_vat),
            "percent_rate": float(rate_row.percent_rate) if rate_row.percent_rate is not None else None,
            "benchmark_airfield_code": rate_row.benchmark_airfield_code,
            "benchmark_multiplier": float(rate_row.benchmark_multiplier) if rate_row.benchmark_multiplier is not None else None,
        },
        "expense_inputs": {
            "total_amount": float(total),
            "currency": exp_ccy,
            "vat_amount": float(vat),
            "volume": float(expense.volume),
            "unit": expense.unit.upper(),
            "country_code": expense.country_code.upper(),
            "airfield_code": expense.airfield_code.upper() if expense.airfield_code else None,
        },
        "actuals": {
            "actual_reimbursable": {"amount": float(actual_reimbursable), "currency": exp_ccy, "vat_reimbursed": bool(rate_row.reimburse_vat)},
            "converted_to_policy": {
                "amount": float(actual_in_policy),
                "currency": policy_ccy,
                "effective_date": fx_date_actual.isoformat(),
                "derivation": fx_derivation_actual,
                "fx": fx_actual_details,
            },
        },
    }

    if rate_row.calc_type == CountryCalcType.PERCENT_TOTAL:
        if rate_row.percent_rate is None:
            raise ValueError("percent_rate is required for PERCENT_TOTAL")
        refund = actual_in_policy * Decimal(str(rate_row.percent_rate))
        details["calculation"] = {
            "type": "PERCENT_TOTAL",
            "formula": "refund = actual_in_policy * percent_rate",
            "actual_in_policy": float(actual_in_policy),
            "percent_rate": float(rate_row.percent_rate),
            "refund_amount": float(refund),
            "refund_currency": policy_ccy,
        }
        return RefundResult(
            effective_date=fx_date_actual,
            refund_amount=refund,
            refund_currency=policy_ccy,
            derivation=f"PERCENT_TOTAL({fx_derivation_actual})",
            explanation="Percent of actuals",
            details=details,
        )

    if not rate_row.benchmark_airfield_code:
        raise ValueError("benchmark_airfield_code is required for benchmark-based rules")
    multiplier = Decimal(str(rate_row.benchmark_multiplier)) if rate_row.benchmark_multiplier is not None else Decimal("1")

    liters = _volume_liters(expense)

    if rate_row.calc_type in {CountryCalcType.BENCHMARK_EX_VAT, CountryCalcType.ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT}:
        benchmark_includes_vat = False
    else:
        benchmark_includes_vat = bool(rate_row.reimburse_vat)

    bench = _resolve_benchmark_price(
        db,
        policy_id=policy.id,
        airfield_code=rate_row.benchmark_airfield_code,
        includes_vat=benchmark_includes_vat,
        on_date=on_date,
    )

    bench_total = liters * bench.price_per_unit
    bench_total_policy, fx_date_bench, fx_derivation_bench, fx_bench_details = _convert_detailed(
        db, amount=bench_total, from_ccy=bench.currency, to_ccy=policy_ccy, on_date=on_date
    )
    bench_cap = bench_total_policy * multiplier

    details["volume"] = {"liters": float(liters), "gal_to_l_factor": float(GAL_TO_L)}
    details["benchmark"] = {
        "airfield_code": rate_row.benchmark_airfield_code,
        "includes_vat_requested": bool(benchmark_includes_vat),
        "currency": bench.currency,
        "price_per_unit": float(bench.price_per_unit),
        "price_effective_from": bench.effective_from.isoformat(),
        "vat_rate": float(bench.vat_rate),
        "derived": bool(bench.derived),
        "benchmark_total": {"amount": float(bench_total), "currency": bench.currency},
        "converted_to_policy": {
            "amount": float(bench_total_policy),
            "currency": policy_ccy,
            "effective_date": fx_date_bench.isoformat(),
            "derivation": fx_derivation_bench,
            "fx": fx_bench_details,
        },
        "multiplier": float(multiplier),
        "cap_amount": float(bench_cap),
    }

    if rate_row.calc_type == CountryCalcType.BENCHMARK_EX_VAT:
        details["calculation"] = {
            "type": "BENCHMARK_EX_VAT",
            "formula": "refund = bench_total_policy",
            "refund_amount": float(bench_total_policy),
            "refund_currency": policy_ccy,
        }
        return RefundResult(
            effective_date=min(fx_date_actual, fx_date_bench),
            refund_amount=bench_total_policy,
            refund_currency=policy_ccy,
            derivation=f"BENCHMARK_EX_VAT({fx_derivation_bench})",
            explanation="Benchmark ex VAT",
            details=details,
        )

    if rate_row.calc_type in {CountryCalcType.ACTUALS_CAPPED_TO_BENCHMARK, CountryCalcType.ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT}:
        refund = actual_in_policy if actual_in_policy <= bench_cap else bench_cap
        details["calculation"] = {
            "type": "ACTUALS_CAPPED_TO_BENCHMARK",
            "formula": "refund = min(actual_in_policy, bench_total_policy * multiplier)",
            "actual_in_policy": float(actual_in_policy),
            "bench_cap": float(bench_cap),
            "refund_amount": float(refund),
            "refund_currency": policy_ccy,
            "capped": bool(actual_in_policy > bench_cap),
        }
        return RefundResult(
            effective_date=min(fx_date_actual, fx_date_bench),
            refund_amount=refund,
            refund_currency=policy_ccy,
            derivation=f"MIN(ACTUAL({fx_derivation_actual}),BENCH*{multiplier}({fx_derivation_bench}))",
            explanation="Actuals capped to benchmark",
            details=details,
        )

    raise ValueError(f"Unsupported calc_type {rate_row.calc_type}")

