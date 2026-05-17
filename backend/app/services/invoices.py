from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


_MONTH_RE = re.compile(r"^(\d{4})-(\d{2})$")
_MONTH_NAMES = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)


def parse_month(s: str) -> tuple[date, date]:
    """Parse 'YYYY-MM' into (start_of_month, first_of_next_month).

    The end is exclusive: use `purchased_at < end` for filtering.
    """
    m = _MONTH_RE.match(s or "")
    if not m:
        raise ValueError("Invalid month")
    year = int(m.group(1))
    month = int(m.group(2))
    if month < 1 or month > 12:
        raise ValueError("Invalid month")
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    return start, end


def slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s or "untitled"


@dataclass(frozen=True)
class PilotInvoiceLine:
    purchased_at: datetime
    airfield_code: str | None
    vendor: str | None
    volume: Decimal
    unit: str
    total_amount: Decimal
    currency: str
    refund_amount: Decimal | None
    refund_currency: str | None


@dataclass(frozen=True)
class InvoiceAircraft:
    registration: str
    make: str
    model: str


@dataclass(frozen=True)
class InvoicePilot:
    name: str
    email: str | None


@dataclass
class PilotInvoice:
    aircraft: InvoiceAircraft
    pilot: InvoicePilot
    period_start: date
    period_end_exclusive: date
    lines: list[PilotInvoiceLine] = field(default_factory=list)
    totals_spent: dict[str, Decimal] = field(default_factory=dict)
    totals_refund: dict[str, Decimal] = field(default_factory=dict)


def build_pilot_invoice(
    *,
    aircraft: InvoiceAircraft,
    pilot: InvoicePilot,
    period_start: date,
    period_end_exclusive: date,
    lines: list[PilotInvoiceLine],
) -> PilotInvoice:
    totals_spent: dict[str, Decimal] = {}
    totals_refund: dict[str, Decimal] = {}
    for ln in lines:
        totals_spent[ln.currency] = totals_spent.get(ln.currency, Decimal(0)) + ln.total_amount
        if ln.refund_amount is not None and ln.refund_currency:
            totals_refund[ln.refund_currency] = (
                totals_refund.get(ln.refund_currency, Decimal(0)) + ln.refund_amount
            )
    return PilotInvoice(
        aircraft=aircraft,
        pilot=pilot,
        period_start=period_start,
        period_end_exclusive=period_end_exclusive,
        lines=sorted(lines, key=lambda l: l.purchased_at),
        totals_spent=totals_spent,
        totals_refund=totals_refund,
    )


def _fmt_money(amount: Decimal, currency: str) -> str:
    # Two decimal places is fine for an invoice; avoid locale-specific quirks.
    q = amount.quantize(Decimal("0.01"))
    sign = "-" if q < 0 else ""
    abs_str = f"{abs(q):,.2f}"
    return f"{sign}{abs_str} {currency}"


def _fmt_volume(volume: Decimal, unit: str) -> str:
    q = volume.quantize(Decimal("0.01"))
    return f"{q:,.2f} {unit}"


def _fmt_totals(totals: dict[str, Decimal]) -> str:
    if not totals:
        return "—"
    return ", ".join(_fmt_money(v, ccy) for ccy, v in sorted(totals.items()))


def _period_label(period_start: date) -> str:
    return f"{_MONTH_NAMES[period_start.month - 1]} {period_start.year}"


def render_pilot_invoice_pdf(invoice: PilotInvoice) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Fuel invoice — {invoice.pilot.name} — {_period_label(invoice.period_start)}",
        author="Fuel Books",
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=18, spaceAfter=4)
    h_label = ParagraphStyle("hLabel", parent=styles["Normal"], fontSize=8, textColor=colors.grey, leading=10)
    h_value = ParagraphStyle("hValue", parent=styles["Normal"], fontSize=10, leading=13)
    foot = ParagraphStyle("foot", parent=styles["Normal"], fontSize=10, leading=14)
    foot_label = ParagraphStyle("footLabel", parent=styles["Normal"], fontSize=9, textColor=colors.grey, leading=12)

    story: list = []

    story.append(Paragraph("Fuel invoice", h1))
    story.append(
        Paragraph(
            f"For {invoice.pilot.name} — {_period_label(invoice.period_start)}",
            ParagraphStyle("sub", parent=styles["Normal"], fontSize=11, textColor=colors.grey, spaceAfter=12),
        )
    )

    aircraft_value = (
        f"{invoice.aircraft.registration} — {invoice.aircraft.make} {invoice.aircraft.model}"
    )
    pilot_value = invoice.pilot.name + (
        f" &lt;{invoice.pilot.email}&gt;" if invoice.pilot.email else ""
    )
    period_value = (
        f"{invoice.period_start.isoformat()} to "
        f"{(invoice.period_end_exclusive).isoformat()} (exclusive)"
    )
    generated_value = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    meta_table = Table(
        [
            [Paragraph("Aircraft", h_label), Paragraph(aircraft_value, h_value)],
            [Paragraph("Pilot", h_label), Paragraph(pilot_value, h_value)],
            [Paragraph("Period", h_label), Paragraph(period_value, h_value)],
            [Paragraph("Generated", h_label), Paragraph(generated_value, h_value)],
        ],
        colWidths=[28 * mm, None],
        hAlign="LEFT",
    )
    meta_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 14))

    header = ["Date", "Airfield", "Vendor", "Volume", "Total", "Refund"]
    rows: list[list[str]] = [header]
    if not invoice.lines:
        rows.append(["—", "—", "—", "—", "—", "—"])
    for ln in invoice.lines:
        refund_cell = (
            _fmt_money(ln.refund_amount, ln.refund_currency)
            if ln.refund_amount is not None and ln.refund_currency
            else "—"
        )
        rows.append(
            [
                ln.purchased_at.date().isoformat(),
                ln.airfield_code or "—",
                (ln.vendor or "—")[:48],
                _fmt_volume(ln.volume, ln.unit),
                _fmt_money(ln.total_amount, ln.currency),
                refund_cell,
            ]
        )

    table = Table(rows, repeatRows=1, hAlign="LEFT", colWidths=[24 * mm, 22 * mm, None, 28 * mm, 32 * mm, 32 * mm])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#27272A")),
                ("ALIGN", (3, 1), (5, -1), "RIGHT"),
                ("ALIGN", (3, 0), (5, 0), "RIGHT"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#27272A")),
                ("LINEBELOW", (0, -1), (-1, -1), 0.25, colors.HexColor("#E4E4E7")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 16))

    totals_table = Table(
        [
            [Paragraph("Total spent", foot_label), Paragraph(_fmt_totals(invoice.totals_spent), foot)],
            [Paragraph("Total refund", foot_label), Paragraph(_fmt_totals(invoice.totals_refund), foot)],
            [Paragraph("Expenses", foot_label), Paragraph(str(len(invoice.lines)), foot)],
        ],
        colWidths=[32 * mm, None],
        hAlign="LEFT",
    )
    totals_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(totals_table)

    doc.build(story)
    return buf.getvalue()


def build_zip(files: list[tuple[str, bytes]]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for filename, data in files:
            zf.writestr(filename, data)
    return buf.getvalue()
