"""Atomic wallet operations.

Every public function runs inside a DB transaction and locks the wallets it
touches with `select_for_update()` in a stable pk order — two concurrent
transfers over the same pair can't deadlock or race the balance. Balances can
never go negative: a debit that would overdraw raises `InsufficientFunds` and
rolls the whole transaction back.
"""

from __future__ import annotations

from django.db import transaction

from .models import Wallet, WalletTransaction


class WalletError(Exception):
    """Base for wallet operation failures; views turn these into 400s."""


class InsufficientFunds(WalletError):
    def __init__(self, message: str = "Balans yetarli emas."):
        super().__init__(message)


def get_or_create_wallet(user) -> Wallet:
    wallet, _ = Wallet.objects.get_or_create(user=user)
    return wallet


def get_platform_wallet() -> Wallet:
    wallet, _ = Wallet.objects.get_or_create(
        is_platform=True, defaults={"user": None}
    )
    return wallet


def _locked(*wallet_ids: int) -> dict[int, Wallet]:
    """Re-fetch the given wallets FOR UPDATE, ordered by pk so any two callers
    grab the same locks in the same sequence (deadlock-free)."""
    return {
        w.pk: w
        for w in Wallet.objects.select_for_update()
        .filter(pk__in=set(wallet_ids))
        .order_by("pk")
    }


def _post(
    wallet: Wallet,
    amount: int,
    tx_type: str,
    *,
    presentation=None,
    counterparty: Wallet | None = None,
    note: str = "",
) -> WalletTransaction:
    """Apply a signed delta to an already-locked wallet and write the ledger
    row. Caller owns the surrounding transaction + lock."""
    new_balance = wallet.balance + amount
    if new_balance < 0:
        raise InsufficientFunds()
    wallet.balance = new_balance
    wallet.save(update_fields=["balance", "updated_at"])
    return WalletTransaction.objects.create(
        wallet=wallet,
        amount=amount,
        balance_after=new_balance,
        type=tx_type,
        presentation=presentation,
        counterparty=counterparty,
        note=note,
    )


@transaction.atomic
def deposit(user, amount: int, *, note: str = "") -> WalletTransaction:
    """Manual top-up (admin credits a teacher's balance). Payment-gateway
    integrations will call this same entry point later."""
    if amount <= 0:
        raise WalletError("Summa musbat bo'lishi kerak.")
    wallet = get_or_create_wallet(user)
    wallet = _locked(wallet.pk)[wallet.pk]
    return _post(wallet, amount, WalletTransaction.Type.TOPUP, note=note)


@transaction.atomic
def withdraw(user, amount: int, *, note: str = "") -> WalletTransaction:
    """Payout: reduce a teacher's balance once the platform has paid them out."""
    if amount <= 0:
        raise WalletError("Summa musbat bo'lishi kerak.")
    wallet = get_or_create_wallet(user)
    wallet = _locked(wallet.pk)[wallet.pk]
    return _post(wallet, -amount, WalletTransaction.Type.WITHDRAWAL, note=note)


@transaction.atomic
def adjust(user, amount: int, *, note: str = "") -> WalletTransaction:
    """Admin correction. `amount` may be negative; still bounded at zero."""
    if amount == 0:
        raise WalletError("Summa nol bo'lishi mumkin emas.")
    wallet = get_or_create_wallet(user)
    wallet = _locked(wallet.pk)[wallet.pk]
    return _post(wallet, amount, WalletTransaction.Type.ADJUSTMENT, note=note)


@transaction.atomic
def charge_generation(
    user, amount: int, *, presentation=None, note: str = ""
) -> WalletTransaction:
    """Teacher pays to generate a presentation. Generation itself is free
    (OmniRoute), so the fee is pure platform revenue: user -> platform."""
    if amount <= 0:
        raise WalletError("Summa musbat bo'lishi kerak.")
    uw = get_or_create_wallet(user)
    pw = get_platform_wallet()
    locked = _locked(uw.pk, pw.pk)
    uw, pw = locked[uw.pk], locked[pw.pk]
    debit = _post(
        uw,
        -amount,
        WalletTransaction.Type.GENERATION_FEE,
        presentation=presentation,
        counterparty=pw,
        note=note,
    )
    _post(
        pw,
        amount,
        WalletTransaction.Type.GENERATION_FEE,
        presentation=presentation,
        counterparty=uw,
        note=note,
    )
    return debit


@transaction.atomic
def refund_generation(
    user, amount: int, *, presentation=None, note: str = "Generatsiya qaytarildi"
) -> WalletTransaction:
    """Reverse a generation fee when generation fails: platform -> user. Uses
    ADJUSTMENT entries so the ledger still balances without a new type."""
    if amount <= 0:
        raise WalletError("Summa musbat bo'lishi kerak.")
    uw = get_or_create_wallet(user)
    pw = get_platform_wallet()
    locked = _locked(uw.pk, pw.pk)
    uw, pw = locked[uw.pk], locked[pw.pk]
    _post(
        pw,
        -amount,
        WalletTransaction.Type.ADJUSTMENT,
        presentation=presentation,
        counterparty=uw,
        note=note,
    )
    return _post(
        uw,
        amount,
        WalletTransaction.Type.ADJUSTMENT,
        presentation=presentation,
        counterparty=pw,
        note=note,
    )


@transaction.atomic
def purchase(
    buyer, seller, amount: int, *, commission: int, presentation=None, note: str = ""
) -> WalletTransaction:
    """Buyer pays `amount` for a presentation. `commission` goes to the
    platform, the remainder to the seller — one atomic 3-wallet transfer.
    Returns the buyer's debit row."""
    if amount <= 0 or commission < 0 or commission > amount:
        raise WalletError("Noto'g'ri summa yoki komissiya.")
    if buyer == seller:
        raise WalletError("O'z taqdimotingizni sotib ololmaysiz.")
    bw = get_or_create_wallet(buyer)
    sw = get_or_create_wallet(seller)
    pw = get_platform_wallet()
    locked = _locked(bw.pk, sw.pk, pw.pk)
    bw, sw, pw = locked[bw.pk], locked[sw.pk], locked[pw.pk]
    debit = _post(
        bw,
        -amount,
        WalletTransaction.Type.PURCHASE,
        presentation=presentation,
        counterparty=sw,
        note=note,
    )
    _post(
        sw,
        amount - commission,
        WalletTransaction.Type.SALE_INCOME,
        presentation=presentation,
        counterparty=bw,
        note=note,
    )
    if commission:
        _post(
            pw,
            commission,
            WalletTransaction.Type.COMMISSION,
            presentation=presentation,
            counterparty=bw,
            note=note,
        )
    return debit
