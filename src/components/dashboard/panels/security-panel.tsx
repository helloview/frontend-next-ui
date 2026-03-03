import Link from "next/link";

import type { DashboardData } from "@/components/dashboard/types";

type SecurityPanelProps = {
  data: DashboardData;
};

export function SecurityPanel({ data }: SecurityPanelProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-ink-900">安全设置</h2>

      <div className="glass">
        <div className="border-b border-ink-200 bg-ink-100/60 px-4 py-2 text-xs text-ink-600">JWT Claims Snapshot</div>
        <div className="overflow-x-auto bg-ink-950 p-4 font-mono text-xs text-ink-200">
          <pre>{JSON.stringify({ sub: data.me.id, roles: data.me.roles, scopes: data.me.scopes }, null, 2)}</pre>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href="/forgot-password"
          className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-medium text-ink-800 transition hover:bg-ink-100"
        >
          申请密码重置码
        </Link>
        <Link
          href="/reset-password"
          className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-medium text-ink-800 transition hover:bg-ink-100"
        >
          提交验证码重置
        </Link>
      </div>
    </section>
  );
}
