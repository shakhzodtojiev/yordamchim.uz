from rest_framework import serializers

from .models import Wallet, WalletTransaction


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ("balance", "updated_at")


class WalletTransactionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    presentation_title = serializers.CharField(
        source="presentation.title", read_only=True, default=None
    )

    class Meta:
        model = WalletTransaction
        fields = (
            "id",
            "amount",
            "balance_after",
            "type",
            "type_display",
            "presentation",
            "presentation_title",
            "note",
            "created_at",
        )
