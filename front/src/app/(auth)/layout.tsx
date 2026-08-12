import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-secondary/40 to-background px-4">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="flex items-center justify-center gap-2 text-center text-2xl font-bold tracking-tight">
          <img src="/yordamchim.svg" alt="Yordamchim Logo" className="w-8 h-8" />
          Yordamchim
        </Link>
        {children}
        <Link
          href="/"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
