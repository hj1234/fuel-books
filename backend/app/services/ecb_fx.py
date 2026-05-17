from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Final
from xml.etree import ElementTree

import httpx


ECB_HIST_XML_URL: Final[str] = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml"


@dataclass(frozen=True)
class EcbFxRate:
    effective_date: date
    quote_currency: str
    rate: Decimal  # 1 EUR = rate quote


def _parse_ecb_hist_xml(xml_text: str) -> list[EcbFxRate]:
    root = ElementTree.fromstring(xml_text)
    out: list[EcbFxRate] = []

    # Namespaces are present; ignore by matching local-name suffixes.
    # Expected structure: Envelope/Cube/Cube(time=YYYY-MM-DD)/Cube(currency=XXX, rate=Y)
    for time_cube in root.iter():
        if not time_cube.tag.endswith("Cube"):
            continue
        time_attr = time_cube.attrib.get("time")
        if not time_attr:
            continue
        effective = datetime.strptime(time_attr, "%Y-%m-%d").date()
        for rate_cube in list(time_cube):
            if not rate_cube.tag.endswith("Cube"):
                continue
            ccy = rate_cube.attrib.get("currency")
            rate = rate_cube.attrib.get("rate")
            if not ccy or not rate:
                continue
            out.append(EcbFxRate(effective_date=effective, quote_currency=ccy.upper(), rate=Decimal(rate)))
    return out


async def fetch_ecb_hist_rates(client: httpx.AsyncClient | None = None) -> list[EcbFxRate]:
    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=30)
        close_client = True
    try:
        resp = await client.get(ECB_HIST_XML_URL)
        resp.raise_for_status()
        return _parse_ecb_hist_xml(resp.text)
    finally:
        if close_client:
            await client.aclose()

