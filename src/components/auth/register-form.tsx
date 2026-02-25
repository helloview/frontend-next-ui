"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button, getPasswordStrengthLevel, Input, PasswordStrength } from "@/components/auth/auth-primitives";
import { AuthShell } from "@/components/auth/auth-shell";
import { registerWithCredentials } from "@/lib/auth-api";

const registerSchema = z
  .object({
    nickname: z.string().min(2, "昵称至少 2 个字符"),
    email: z.string().email("请输入有效邮箱"),
    password: z.string().min(8, "密码至少 8 位"),
    confirmPassword: z.string().min(1, "请确认密码"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致。",
    path: ["confirmPassword"],
  });

type RegisterSchema = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      nickname: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = form.watch("password");
  const strength = useMemo(() => getPasswordStrengthLevel(password), [password]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (strength < 3) {
      form.setError("password", { message: "密码强度不足，请至少包含字母和数字并达到 8 位。" });
      return;
    }

    setIsPending(true);
    try {
      await registerWithCredentials({
        nickname: values.nickname,
        email: values.email,
        password: values.password,
      });

      const loginResult = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (!loginResult || loginResult.error) {
        throw new Error("账号已创建，但自动登录失败，请返回登录页手动登录。");
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建账号失败，请稍后重试");
    } finally {
      setIsPending(false);
    }
  });

  return (
    <AuthShell>
      <div className="w-full max-w-[320px] animate-in space-y-8 fade-in slide-in-from-right-8 duration-300">
        <div className="space-y-2 text-center lg:text-left">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">创建账号</h2>
          <p className="text-[13px] text-zinc-500">使用邮箱创建账号，几秒钟即可开始。</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <Input
            id="nickname"
            label="昵称"
            type="text"
            autoComplete="name"
            error={form.formState.errors.nickname?.message}
            {...form.register("nickname")}
          />

          <Input
            id="email"
            label="邮箱"
            type="email"
            autoComplete="email"
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />

          <div className="space-y-2">
            <Input
              id="password"
              label="登录密码"
              type="password"
              autoComplete="new-password"
              error={form.formState.errors.password?.message}
              {...form.register("password")}
            />
            {password ? <PasswordStrength password={password} /> : null}
          </div>

          <Input
            id="confirmPassword"
            label="确认密码"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.confirmPassword?.message}
            {...form.register("confirmPassword")}
          />

          <Button type="submit" isLoading={isPending} className="mt-2" disabled={strength < 3}>
            创建并登录
          </Button>
        </form>

        <p className="text-center text-[13px] text-zinc-500">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center font-medium text-zinc-900 hover:underline underline-offset-4"
          >
            <ChevronRight className="mr-1 h-3 w-3 rotate-180" /> 返回登录
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
