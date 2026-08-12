from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import WalletSerializer, WalletTransactionSerializer
from .services import get_or_create_wallet


class MyWalletView(APIView):
    """Current user's balance. Auto-creates the wallet on first read so a
    freshly registered teacher never 404s."""

    def get(self, request):
        wallet = get_or_create_wallet(request.user)
        return Response(WalletSerializer(wallet).data)


class MyTransactionsView(ListAPIView):
    serializer_class = WalletTransactionSerializer

    def get_queryset(self):
        wallet = get_or_create_wallet(self.request.user)
        return wallet.transactions.select_related("presentation")
