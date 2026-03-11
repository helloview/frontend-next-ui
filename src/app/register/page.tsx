import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage() {
  const session = await auth();
  const fatalErrors = new Set(["MissingRefreshToken", "RefreshTokenExpired"]);

  if (session?.user && session.accessToken && !fatalErrors.has(session.error ?? "")) {
    redirect("/dashboard");
  }

  return (
    <main>
      <RegisterForm />
    </main>
  );
}
