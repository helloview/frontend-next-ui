import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await auth();
  const fatalErrors = new Set(["MissingRefreshToken", "RefreshTokenExpired"]);

  if (session?.user && session.accessToken && !fatalErrors.has(session.error ?? "")) {
    redirect("/dashboard");
  }

  return (
    <main>
      <LoginForm />
    </main>
  );
}
