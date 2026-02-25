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

type LoginFormProps = {
  hasGoogleProvider: boolean;
};

export function LoginForm({ hasGoogleProvider }: LoginFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [isGooglePending, setGooglePending] = useState(false);

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

  const signInWithGoogle = async () => {
    if (!hasGoogleProvider) {
      toast.error("Google 登录暂未启用，请联系管理员");
      return;
    }

    setGooglePending(true);
    await signIn("google", { callbackUrl: "/dashboard" });
    setGooglePending(false);
  };

  return (
    <AuthShell>
      <div className="w-full max-w-[320px] animate-in space-y-8 fade-in duration-500 md:zoom-in-95">
        <div className="space-y-2 text-center lg:text-left">
          <BrandLogoAnimated className="mx-auto mb-4 lg:hidden" logoSize={28} withText={false} />
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">账号登录</h2>
          <p className="text-[13px] text-zinc-500">使用团队账号登录，继续你的创作协作。</p>
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

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
            <span className="bg-white px-2 text-zinc-400">或者</span>
          </div>
        </div>

        <Button type="button" variant="outline" isLoading={isGooglePending} onClick={signInWithGoogle}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          使用 Google 登录
        </Button>

        <p className="text-center text-[13px] text-zinc-500">
          还没有账号？{" "}
          <Link href="/register" className="font-medium text-zinc-900 hover:underline underline-offset-4">
            创建账号
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
