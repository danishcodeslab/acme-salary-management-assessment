import pytest

from app.services.currency import (
    COUNTRIES,
    USD_RATES,
    UnsupportedCountryError,
    currency_for,
    to_usd,
)


def test_every_country_currency_has_a_usd_rate():
    assert {c.currency for c in COUNTRIES.values()} <= USD_RATES.keys()


@pytest.mark.parametrize(("country", "currency"), [("US", "USD"), ("IN", "INR"), ("DE", "EUR")])
def test_currency_for_known_country(country, currency):
    assert currency_for(country) == currency


def test_currency_for_unknown_country_raises():
    with pytest.raises(UnsupportedCountryError):
        currency_for("XX")


@pytest.mark.parametrize(
    ("amount", "currency", "expected"),
    [
        (100_000, "USD", 100_000),
        (8_350_000, "INR", 100_000),
        (92_000, "EUR", 100_000),
        (1, "JPY", 0),  # rounds to nearest whole dollar
        (75, "JPY", 1),  # 0.5 rounds half-up
    ],
)
def test_to_usd(amount, currency, expected):
    assert to_usd(amount, currency) == expected
