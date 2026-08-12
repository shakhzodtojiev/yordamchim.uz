import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-4 text-center">
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-2xl font-bold tracking-tight">Sahifa topilmadi</h1>
        <p className="text-sm text-muted-foreground">
          Bunday manzilda hech narsa yo'q yoki sizda kirish huquqi yo'q.
        </p>
        <Button asChild>
          <Link href={ROUTES.DASHBOARD}>Bosh sahifaga qaytish</Link>
        </Button>
      </div>
    </div>
  );
}
