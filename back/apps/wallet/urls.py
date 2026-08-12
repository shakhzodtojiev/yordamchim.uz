from django.urls import path

from .views import MyTransactionsView, MyWalletView

urlpatterns = [
    path("me/", MyWalletView.as_view(), name="wallet-me"),
    path("me/transactions/", MyTransactionsView.as_view(), name="wallet-transactions"),
]
