from django.conf import settings
from django.db import models
from django.db.models import Q


class Wallet(models.Model):
    """Per-user so'm balance.

    Exactly one platform-owned wallet (`is_platform=True`, no user) collects
    generation fees and sale commissions. Keeping it as a real wallet means
    every debit has a matching credit, so the ledger balances and platform
    revenue is just this wallet's inflow — no special-case accounting.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wallet",
        null=True,
        blank=True,
    )
    is_platform = models.BooleanField(default=False)
    # so'm (UZS) — whole numbers only; the currency has no sub-unit in use.
    balance = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # At most one platform wallet.
            models.UniqueConstraint(
                fields=("is_platform",),
                condition=Q(is_platform=True),
                name="wallet_single_platform",
            ),
            # A wallet is either the platform's (no user) or a user's — never
            # both, never neither.
            models.CheckConstraint(
                name="wallet_user_xor_platform",
                check=(
                    Q(is_platform=True, user__isnull=True)
                    | Q(is_platform=False, user__isnull=False)
                ),
            ),
        ]

    def __str__(self) -> str:
        return "platform" if self.is_platform else f"wallet<{self.user_id}>"


class WalletTransaction(models.Model):
    """Append-only ledger entry. One row per wallet side of a money movement;
    a transfer (purchase, generation fee) writes two rows that reference each
    other via `counterparty`."""

    class Type(models.TextChoices):
        TOPUP = "topup", "Balans to'ldirish"
        GENERATION_FEE = "generation_fee", "Taqdimot generatsiyasi"
        PURCHASE = "purchase", "Taqdimot sotib olish"
        SALE_INCOME = "sale_income", "Sotuvdan daromad"
        COMMISSION = "commission", "Platforma komissiyasi"
        WITHDRAWAL = "withdrawal", "Yechib olish"
        ADJUSTMENT = "adjustment", "Qo'lda tuzatish"

    wallet = models.ForeignKey(
        Wallet, on_delete=models.CASCADE, related_name="transactions"
    )
    # Signed: credits positive, debits negative. `balance_after` snapshots the
    # running balance so an audit never has to replay the whole log.
    amount = models.BigIntegerField()
    balance_after = models.PositiveBigIntegerField()
    type = models.CharField(max_length=20, choices=Type.choices)
    presentation = models.ForeignKey(
        "presentations.Presentation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="wallet_transactions",
    )
    # The other wallet in a transfer (buyer<->seller, user<->platform). Null
    # for one-sided events like a manual top-up.
    counterparty = models.ForeignKey(
        Wallet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("wallet", "-created_at")),
            models.Index(fields=("type", "-created_at")),
        ]

    def __str__(self) -> str:
        return f"{self.type} {self.amount:+d}"
