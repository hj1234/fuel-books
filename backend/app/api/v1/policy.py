from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_aircraft_roles, resolve_aircraft_by_public_id
from app.db.session import get_db
from app.models.aircraft_membership import AircraftMembership, MembershipRole, MembershipStatus
from app.models.aircraft_fuel_policy import AircraftFuelPolicy
from app.models.aircraft import Aircraft
from app.models.fuel_policy import FuelPolicy, FuelPolicyCountryRate
from app.models.user import User
from app.schemas.policy import (
    CountryRateOut,
    CountryRateUpsert,
    FuelPolicyOut,
    FuelPolicyUpsert,
    PolicyImportCandidateOut,
    PolicyImportPayload,
)

router = APIRouter(tags=["policy"])


def _require_admin_membership_pk(db: Session, *, aircraft_pk: int, user_id: int) -> AircraftMembership:
    membership = db.scalar(
        select(AircraftMembership).where(
            AircraftMembership.aircraft_id == aircraft_pk,
            AircraftMembership.user_id == user_id,
            AircraftMembership.status == MembershipStatus.ACTIVE,
        )
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aircraft not found")
    if membership.role != MembershipRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role for aircraft")
    return membership


@router.get("/v1/aircraft/{aircraft_id}/policy", response_model=FuelPolicyOut)
def get_policy(
    aircraft_id: str,
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(require_aircraft_roles(MembershipRole.ADMIN, MembershipRole.PILOT)),
) -> FuelPolicyOut:
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    mapping = db.scalar(select(AircraftFuelPolicy).where(AircraftFuelPolicy.aircraft_id == aircraft.id))
    policy = db.get(FuelPolicy, mapping.fuel_policy_id) if mapping else None
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")
    return FuelPolicyOut(id=policy.public_id, aircraft_id=aircraft.public_id, base_currency=policy.base_currency)


@router.put("/v1/aircraft/{aircraft_id}/policy", response_model=FuelPolicyOut)
def upsert_policy(
    aircraft_id: str,
    payload: FuelPolicyUpsert,
    db: Session = Depends(get_db),
    membership: AircraftMembership = Depends(require_aircraft_roles(MembershipRole.ADMIN)),
) -> FuelPolicyOut:
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    mapping = db.scalar(select(AircraftFuelPolicy).where(AircraftFuelPolicy.aircraft_id == aircraft.id))
    if not mapping:
        policy = FuelPolicy(owner_user_id=membership.user_id, base_currency=payload.base_currency.upper())
        db.add(policy)
        db.commit()
        db.refresh(policy)
        mapping = AircraftFuelPolicy(aircraft_id=aircraft.id, fuel_policy_id=policy.id)
        db.add(mapping)
        db.commit()
    else:
        policy = db.get(FuelPolicy, mapping.fuel_policy_id)
        if not policy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")
        if policy.owner_user_id != membership.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Policy not owned by user")
        policy.base_currency = payload.base_currency.upper()
        db.commit()
        db.refresh(policy)
    return FuelPolicyOut(id=policy.public_id, aircraft_id=aircraft.public_id, base_currency=policy.base_currency)


def _country_rate_to_out(r: FuelPolicyCountryRate, policy_public_id: str) -> CountryRateOut:
    return CountryRateOut(
        id=r.id,
        policy_id=policy_public_id,
        country_code=r.country_code,
        effective_from=r.effective_from,
        effective_to=r.effective_to,
        calc_type=r.calc_type.value,
        percent_rate=float(r.percent_rate) if r.percent_rate is not None else None,
        benchmark_airfield_code=r.benchmark_airfield_code,
        benchmark_multiplier=float(r.benchmark_multiplier) if r.benchmark_multiplier is not None else None,
        reimburse_vat=r.reimburse_vat,
    )


@router.get("/v1/aircraft/{aircraft_id}/policy/country-rates", response_model=list[CountryRateOut])
def list_country_rates(
    aircraft_id: str,
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(require_aircraft_roles(MembershipRole.ADMIN, MembershipRole.PILOT)),
) -> list[CountryRateOut]:
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    mapping = db.scalar(select(AircraftFuelPolicy).where(AircraftFuelPolicy.aircraft_id == aircraft.id))
    policy = db.get(FuelPolicy, mapping.fuel_policy_id) if mapping else None
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")
    rows = db.scalars(
        select(FuelPolicyCountryRate)
        .where(FuelPolicyCountryRate.policy_id == policy.id)
        .order_by(FuelPolicyCountryRate.country_code, FuelPolicyCountryRate.effective_from.desc())
    ).all()
    return [_country_rate_to_out(r, policy.public_id) for r in rows]


@router.put("/v1/aircraft/{aircraft_id}/policy/country-rates", response_model=list[CountryRateOut])
def replace_country_rates(
    aircraft_id: str,
    payload: list[CountryRateUpsert],
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(require_aircraft_roles(MembershipRole.ADMIN)),
) -> list[CountryRateOut]:
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    mapping = db.scalar(select(AircraftFuelPolicy).where(AircraftFuelPolicy.aircraft_id == aircraft.id))
    policy = db.get(FuelPolicy, mapping.fuel_policy_id) if mapping else None
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")

    db.execute(delete(FuelPolicyCountryRate).where(FuelPolicyCountryRate.policy_id == policy.id))
    for row in payload:
        db.add(
            FuelPolicyCountryRate(
                policy_id=policy.id,
                country_code=row.country_code.upper(),
                effective_from=row.effective_from,
                effective_to=row.effective_to,
                calc_type=row.calc_type,
                percent_rate=row.percent_rate,
                benchmark_airfield_code=row.benchmark_airfield_code.upper() if row.benchmark_airfield_code else None,
                benchmark_multiplier=row.benchmark_multiplier,
                reimburse_vat=row.reimburse_vat,
            )
        )
    db.commit()
    # Re-query so the returned rows include the database-assigned ids.
    rows = db.scalars(
        select(FuelPolicyCountryRate)
        .where(FuelPolicyCountryRate.policy_id == policy.id)
        .order_by(FuelPolicyCountryRate.country_code, FuelPolicyCountryRate.effective_from.desc())
    ).all()
    return [_country_rate_to_out(r, policy.public_id) for r in rows]


@router.get("/v1/policy/import-candidates", response_model=list[PolicyImportCandidateOut])
def list_import_candidates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PolicyImportCandidateOut]:
    rows = db.execute(
        select(
            Aircraft.public_id,
            Aircraft.registration,
            Aircraft.home_base_airfield,
            FuelPolicy.public_id,
            FuelPolicy.base_currency,
        )
        .join(AircraftMembership, AircraftMembership.aircraft_id == Aircraft.id)
        .join(AircraftFuelPolicy, AircraftFuelPolicy.aircraft_id == Aircraft.id)
        .join(FuelPolicy, FuelPolicy.id == AircraftFuelPolicy.fuel_policy_id)
        .where(
            AircraftMembership.user_id == current_user.id,
            AircraftMembership.status == MembershipStatus.ACTIVE,
            AircraftMembership.role == MembershipRole.ADMIN,
        )
        .order_by(Aircraft.registration.asc())
    ).all()

    return [
        PolicyImportCandidateOut(
            aircraft_id=str(aircraft_public_id),
            aircraft_registration=str(registration),
            home_base_airfield=(str(home_base) if home_base else None),
            policy_id=str(policy_public_id),
            base_currency=str(base_currency),
        )
        for aircraft_public_id, registration, home_base, policy_public_id, base_currency in rows
    ]


@router.post("/v1/aircraft/{aircraft_id}/policy/import", response_model=FuelPolicyOut)
def import_policy_from_aircraft(
    aircraft_id: str,
    payload: PolicyImportPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FuelPolicyOut:
    target_aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    source_aircraft = resolve_aircraft_by_public_id(db, payload.source_aircraft_id)

    _require_admin_membership_pk(db, aircraft_pk=target_aircraft.id, user_id=current_user.id)
    _require_admin_membership_pk(db, aircraft_pk=source_aircraft.id, user_id=current_user.id)

    source_mapping = db.scalar(
        select(AircraftFuelPolicy).where(AircraftFuelPolicy.aircraft_id == source_aircraft.id)
    )
    source_policy = db.get(FuelPolicy, source_mapping.fuel_policy_id) if source_mapping else None
    if not source_policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source policy not found")
    if source_policy.owner_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Policy not owned by user")

    mapping = db.scalar(select(AircraftFuelPolicy).where(AircraftFuelPolicy.aircraft_id == target_aircraft.id))
    if not mapping:
        mapping = AircraftFuelPolicy(aircraft_id=target_aircraft.id, fuel_policy_id=source_policy.id)
        db.add(mapping)
        db.commit()
    else:
        mapping.fuel_policy_id = source_policy.id
        db.commit()

    return FuelPolicyOut(
        id=source_policy.public_id,
        aircraft_id=target_aircraft.public_id,
        base_currency=source_policy.base_currency,
    )
