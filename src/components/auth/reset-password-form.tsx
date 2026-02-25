"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";
import { confirmPasswordReset } from "@/lib/auth-api";

const resetSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  code: z.string().length(6, "验证码必须为 6 位"),
  newPassword: z.string().min(8, "新密码至少 8 位"),
});

type ResetSchema = z.infer<typeof resetSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const form = useForm<ResetSchema>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: "",
      code: "",
      newPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (isPending || isCompleted) {
      return;
    }

    setIsPending(true);

    try {
      const payload = await confirmPasswordReset(values);
      setIsCompleted(true);
      toast.success(payload.message || "密码已重置，正在返回登录页。");
      form.reset();
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重置失败");
    } finally {
      setIsPending(false);
    }
  });

  return (
    <AuthCard
      title="重置密码"
      description="输入邮箱、6 位验证码和新密码完成重置。"
      footerText="还没拿到验证码？"
      footerLinkHref="/forgot-password"
      footerLinkText="先申请重置码"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <FormField
          id="email"
          type="email"
          label="工作邮箱"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />

        <FormField
          id="code"
          type="text"
          label="6 位验证码"
          inputMode="numeric"
          maxLength={6}
          error={form.formState.errors.code?.message}
          {...form.register("code")}
        />

        <FormField
          id="new_password"
          type="password"
          label="新密码"
          autoComplete="new-password"
          error={form.formState.errors.newPassword?.message}
          {...form.register("newPassword")}
        />

        <button
          type="submit"
          disabled={isPending || isCompleted}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} 确认重置
        </button>
      </form>
    </AuthCard>
  );
}
