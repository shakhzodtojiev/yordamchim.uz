from django.contrib import admin

from .models import Wallet, WalletTransaction


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "is_platform", "balance", "updated_at")
    list_filter = ("is_platform",)
    search_fields = ("user__email", "user__full_name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "wallet", "type", "amount", "balance_after", "created_at")
    list_filter = ("type",)
    search_fields = ("wallet__user__email", "note")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at",)
