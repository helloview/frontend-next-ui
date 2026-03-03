import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();
  const fatalErrors = new Set(["MissingRefreshToken", "RefreshTokenExpired"]);
  redirect(session?.user && session.accessToken && !fatalErrors.has(session.error ?? "") ? "/dashboard" : "/login");
}
