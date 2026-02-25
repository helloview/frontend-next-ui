"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button, getPasswordStrengthLevel, Input, PasswordStrength } from "@/components/auth/auth-primitives";
import { AuthShell } from "@/components/auth/auth-shell";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/auth-api";

const requestSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
});

const resetSchema = z
  .object({
    code: z.string().length(6, "验证码必须是 6 位"),
    password: z.string().min(8, "密码至少 8 位"),
    confirmPassword: z.string().min(1, "请确认密码"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致。",
    path: ["confirmPassword"],
  });

type RequestSchema = z.infer<typeof requestSchema>;
type ResetSchema = z.infer<typeof resetSchema>;

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [isPending, setIsPending] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [email, setEmail] = useState("");
  const [codeDigits, setCodeDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

  const requestForm = useForm<RequestSchema>({
    resolver: zodResolver(requestSchema),
    mode: "onChange",
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetSchema>({
    resolver: zodResolver(resetSchema),
    mode: "onChange",
    defaultValues: {
      code: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = resetForm.watch("password");
  const strength = useMemo(() => getPasswordStrengthLevel(password), [password]);

  const onRequestCode = requestForm.handleSubmit(async ({ email: inputEmail }) => {
    if (isPending) {
      return;
    }
    setIsPending(true);
    try {
      await requestPasswordReset(inputEmail);
      setEmail(inputEmail);
      setStep(2);
      toast.success("验证码已发送，请检查邮箱。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送失败，请稍后重试");
    } finally {
      setIsPending(false);
    }
  });

  const onReset = resetForm.handleSubmit(async (values) => {
    if (isPending || isCompleted) {
      return;
    }

    if (strength < 3) {
      resetForm.setError("password", { message: "密码强度不足，请至少包含字母和数字并达到 8 位。" });
      return;
    }

    setIsPending(true);
    try {
      await confirmPasswordReset({
        email,
        code: values.code,
        newPassword: values.password,
      });
      setIsCompleted(true);
      toast.success("密码已更新，正在返回登录页。");
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重置失败，请稍后重试");
    } finally {
      setIsPending(false);
    }
  });

  const updateCode = (nextDigits: string[]) => {
    setCodeDigits(nextDigits);
    resetForm.setValue("code", nextDigits.join(""), { shouldValidate: true, shouldDirty: true });
  };

  const fillCodeFrom = (startIndex: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      return;
    }

    const next = [...codeDigits];
    let cursor = startIndex;

    for (const digit of digits) {
      if (cursor > 5) {
        break;
      }
      next[cursor] = digit;
      cursor += 1;
    }

    updateCode(next);
    codeRefs.current[Math.min(cursor, 5)]?.focus();
  };

  const onCodeChange = (index: number, raw: string) => {
    const digitsOnly = raw.replace(/\D/g, "");
    if (digitsOnly.length > 1) {
      fillCodeFrom(index, digitsOnly);
      return;
    }

    const value = digitsOnly.slice(-1);
    const next = [...codeDigits];
    next[index] = value;
    updateCode(next);

    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const onCodeKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !codeDigits[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const onCodePaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    fillCodeFrom(index, event.clipboardData.getData("text"));
  };

  return (
    <AuthShell>
      <div className="w-full max-w-[320px] animate-in space-y-8 fade-in slide-in-from-left-8 duration-300">
        <div className="space-y-2 text-center lg:text-left">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">找回密码</h2>
          <p className="text-[13px] text-zinc-500">
            {step === 1 ? "输入账号邮箱，我们会发送 6 位验证码。" : "请输入验证码并设置新密码。"}
          </p>
        </div>

        {step === 1 ? (
          <form className="space-y-4" onSubmit={onRequestCode}>
            <Input
              id="email"
              label="邮箱"
              type="email"
              autoComplete="email"
              error={requestForm.formState.errors.email?.message}
              {...requestForm.register("email")}
            />
            <Button type="submit" isLoading={isPending} className="mt-2">
              发送验证码
            </Button>
          </form>
        ) : (
          <form className="animate-in space-y-4 fade-in slide-in-from-right-4" onSubmit={onReset}>
            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-zinc-700">6 位验证码</label>
              <div className="flex justify-between gap-2">
                {codeDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      codeRefs.current[index] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(event) => onCodeChange(index, event.target.value)}
                    onKeyDown={(event) => onCodeKeyDown(index, event)}
                    onPaste={(event) => onCodePaste(index, event)}
                    disabled={isPending || isCompleted}
                    className="h-10 w-full rounded-md border border-zinc-200 bg-transparent text-center text-lg font-medium outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                    required
                  />
                ))}
              </div>
              {resetForm.formState.errors.code ? (
                <p className="text-[12px] text-red-500">{resetForm.formState.errors.code.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Input
                id="password"
                label="新密码"
                type="password"
                autoComplete="new-password"
                disabled={isPending || isCompleted}
                error={resetForm.formState.errors.password?.message}
                {...resetForm.register("password")}
              />
              {password ? <PasswordStrength password={password} /> : null}
            </div>

            <Input
              id="confirmPassword"
              label="确认密码"
              type="password"
              autoComplete="new-password"
              disabled={isPending || isCompleted}
              error={resetForm.formState.errors.confirmPassword?.message}
              {...resetForm.register("confirmPassword")}
            />

            <Button type="submit" isLoading={isPending} className="mt-2" disabled={strength < 3 || isCompleted}>
              重置密码
            </Button>
          </form>
        )}

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
