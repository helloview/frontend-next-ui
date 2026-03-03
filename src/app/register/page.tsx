import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function RegisterPage() {
  const session = await auth();
  const fatalErrors = new Set(["MissingRefreshToken", "RefreshTokenExpired"]);

  if (session?.user && session.accessToken && !fatalErrors.has(session.error ?? "")) {
    redirect("/dashboard");
  }

  return (
    <main>
      <AuthShell>
        <div className="w-full max-w-[320px] animate-in space-y-6 fade-in duration-300">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">暂不开放注册</h2>
            <p className="text-[13px] text-zinc-500">当前仅支持内部员工邀请开通账号，请联系管理员获取邀请链接。</p>
          </div>

          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-lg bg-rose-500 px-4 py-2 text-[13px] font-medium text-white shadow-sm shadow-rose-200 transition-all hover:bg-rose-600"
          >
            返回登录
          </Link>
        </div>
      </AuthShell>
    </main>
  );
}
