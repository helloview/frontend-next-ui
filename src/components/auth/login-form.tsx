"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button, Input } from "@/components/auth/auth-primitives";
import { AuthShell } from "@/components/auth/auth-shell";
import { BrandLogoAnimated } from "@/components/brand/brand-logo";

const loginSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  password: z.string().min(8, "密码至少 8 位"),
});

type LoginSchema = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsPending(true);

    const result = await signIn("credentials", {
      ...values,
      redirect: false,
    });

    setIsPending(false);

    if (!result || result.error) {
      toast.error("登录失败，请确认邮箱和密码是否正确");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  });

  return (
    <AuthShell>
      <div className="w-full max-w-[320px] animate-in space-y-8 fade-in duration-500 md:zoom-in-95">
        <div className="space-y-2 text-center lg:text-left">
          <BrandLogoAnimated className="mx-auto mb-4 lg:hidden" logoSize={28} withText={false} />
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">账号登录</h2>
          <p className="text-[13px] text-zinc-500">使用邮箱账号登录，继续你的创作协作。</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <Input
            id="email"
            label="邮箱"
            type="email"
            required
            autoComplete="email"
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />

          <Input
            id="password"
            label="密码"
            type="password"
            required
            autoComplete="current-password"
            error={form.formState.errors.password?.message}
            rightSlot={
              <Link href="/forgot-password" className="text-[12px] font-medium text-zinc-500 transition-colors hover:text-zinc-900">
                忘记密码？
              </Link>
            }
            {...form.register("password")}
          />

          <Button type="submit" isLoading={isPending} className="mt-2">
            登录 <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <p className="text-center text-[13px] text-zinc-500">
          还没有账号？
          <Link href="/register" className="ml-1 font-medium text-zinc-900 transition-colors hover:text-rose-600 hover:underline underline-offset-4">
            立即注册
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
