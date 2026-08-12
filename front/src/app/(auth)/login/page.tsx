import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Xush kelibsiz</CardTitle>
        <CardDescription>Yordamchim akkauntingizga kiring.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={searchParams.next} />
      </CardContent>
    </Card>
  );
}
