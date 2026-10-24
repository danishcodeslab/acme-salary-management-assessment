"""Supported countries, their currencies and static FX rates.

Rates are a fixed snapshot (see RATES_AS_OF) so that insights are deterministic and testable.
Swapping in a live rates provider only requires replacing `USD_RATES`.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

RATES_AS_OF = "2026-01-01"


@dataclass(frozen=True)
class Country:
    code: str
    name: str
    currency: str


COUNTRIES: dict[str, Country] = {
    c.code: c
    for c in [
        Country("US", "United States", "USD"),
        Country("GB", "United Kingdom", "GBP"),
        Country("DE", "Germany", "EUR"),
        Country("FR", "France", "EUR"),
        Country("NL", "Netherlands", "EUR"),
        Country("IN", "India", "INR"),
        Country("CA", "Canada", "CAD"),
        Country("AU", "Australia", "AUD"),
        Country("SG", "Singapore", "SGD"),
        Country("JP", "Japan", "JPY"),
        Country("BR", "Brazil", "BRL"),
        Country("AE", "United Arab Emirates", "AED"),
    ]
}

# Units of local currency per 1 USD.
USD_RATES: dict[str, Decimal] = {
    "USD": Decimal("1"),
    "GBP": Decimal("0.79"),
    "EUR": Decimal("0.92"),
    "INR": Decimal("83.50"),
    "CAD": Decimal("1.36"),
    "AUD": Decimal("1.52"),
    "SGD": Decimal("1.34"),
    "JPY": Decimal("150.00"),
    "BRL": Decimal("5.00"),
    "AED": Decimal("3.6725"),
}


class UnsupportedCountryError(ValueError):
    pass


def currency_for(country_code: str) -> str:
    try:
        return COUNTRIES[country_code].currency
    except KeyError:
        raise UnsupportedCountryError(f"Unsupported country: {country_code}") from None


def usd_rate(currency: str) -> Decimal:
    return USD_RATES[currency]


def to_usd(amount: int | Decimal, currency: str) -> int:
    """Convert a whole-unit amount to whole US dollars (half-up rounding)."""
    value = Decimal(amount) / USD_RATES[currency]
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
