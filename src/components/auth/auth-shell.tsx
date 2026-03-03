"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { CheckCircle2, Loader2, PenTool } from "lucide-react";

type AuthShellProps = {
  children: React.ReactNode;
};

export function AuthShell({ children }: AuthShellProps) {
  const titleLine1 = "把疯狂的脑洞";
  const titleLine2 = "变成被催更的爆款.";
  const description =
    "别让神仙灵感只停留在空想的阶段。无论是天马行空的剧本大纲，还是精雕细琢的分镜手稿，在这里，让每一个好点子都能顺利落地。";

  const [typedTitle, setTypedTitle] = useState("");

  useEffect(() => {
    const fullTitle = `${titleLine1}\n${titleLine2}`;
    let titleIndex = 0;
    let timer: number | null = null;
    let disposed = false;

    const typeTitle = () => {
      if (disposed) return;
      if (titleIndex <= fullTitle.length) {
        setTypedTitle(fullTitle.slice(0, titleIndex));
        const nextChar = fullTitle[titleIndex] ?? "";
        titleIndex += 1;
        const nextDelay = /[，。,.!！]/.test(nextChar) ? 260 : titleIndex % 4 === 0 ? 165 : 112;
        timer = window.setTimeout(typeTitle, nextDelay);
      }
    };

    typeTitle();
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const [typedTitleLine1 = "", typedTitleLine2 = ""] = typedTitle.split("\n");
  const titleDone = typedTitle.length >= `${titleLine1}\n${titleLine2}`.length;

  const bubbles = [
    { id: 1, color: "fce7f3", left: "15%", delay: "0s", dur: "8s", size: "clamp(2.2rem,2.4vw,3.2rem)" },
    { id: 2, color: "ffe4e6", left: "85%", delay: "2s", dur: "7s", size: "clamp(2rem,2vw,2.8rem)" },
    { id: 3, color: "ffedd5", left: "55%", delay: "4s", dur: "9s", size: "clamp(2.4rem,2.8vw,3.6rem)" },
    { id: 4, color: "fce7f3", left: "35%", delay: "1s", dur: "6s", size: "clamp(2.1rem,2.2vw,3rem)" },
    { id: 5, color: "ffe4e6", left: "75%", delay: "5s", dur: "8.5s", size: "clamp(2.2rem,2.4vw,3.2rem)" },
    { id: 6, color: "ffedd5", left: "25%", delay: "3.5s", dur: "7.5s", size: "clamp(2rem,2vw,2.8rem)" },
  ] as const;

  return (
    <div className="h-screen min-h-[100dvh] overflow-hidden bg-white font-sans text-zinc-900 selection:bg-zinc-200">
      <div className="flex h-full overflow-hidden">
        <div className="relative hidden h-full w-1/2 border-r border-zinc-800 bg-zinc-950 px-[clamp(2rem,3.6vw,4rem)] py-[clamp(1.3rem,2.4vh,2.4rem)] text-white lg:flex">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-zinc-950 via-zinc-900/50 to-zinc-950" />
            <div className="animate-blob absolute left-[-15%] top-[5%] z-0 h-[70%] w-[70%] rounded-full bg-rose-600/20 blur-[140px] mix-blend-screen" />
            <div className="animate-blob animation-delay-2000 absolute right-[-10%] top-[-10%] z-0 h-[60%] w-[60%] rounded-full bg-pink-600/20 blur-[130px] mix-blend-screen" />
            <div className="animate-blob animation-delay-4000 absolute bottom-[-20%] left-[10%] z-0 h-[80%] w-[80%] rounded-full bg-orange-500/10 blur-[160px] mix-blend-screen" />

            <div className="pointer-events-none absolute inset-0 z-0">
              {bubbles.map((bubble) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={bubble.id}
                  src={`https://api.dicebear.com/7.x/notionists/svg?seed=u${bubble.id}&backgroundColor=${bubble.color}`}
                  className="animate-bubble-up absolute bottom-[-50px] rounded-full border border-zinc-700/50 opacity-0 shadow-2xl"
                  style={{
                    left: bubble.left,
                    width: bubble.size,
                    height: bubble.size,
                    animationDelay: bubble.delay,
                    animationDuration: bubble.dur,
                  }}
                  alt="avatar bubble"
                />
              ))}
            </div>
          </div>

          <div className="relative z-10 mx-auto grid h-full w-full max-w-[min(94%,58rem)] grid-rows-[auto,1fr,auto]">
            <div className="pt-[clamp(0.2rem,0.9vh,0.8rem)]">
              <BrandLogo
                logoSrc="/logo-dark.svg"
                logoSize={28}
                textClassName="!text-white"
              />
            </div>

            <div className="min-h-0 flex items-center justify-center py-[clamp(1.2rem,3.5vh,3rem)]">
              <div className="w-full max-w-[min(100%,52rem)]">
                <h1 className="mb-5 text-[clamp(2rem,3.8vw,4.4rem)] font-semibold leading-[1.12] tracking-tight text-white">
                  {typedTitleLine1}
                  <br />
                  <span className="bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">{typedTitleLine2}</span>
                  {!titleDone ? <span className="ml-1 inline-block h-[0.9em] w-[0.08em] animate-typing-cursor align-[-0.06em] bg-rose-300" /> : null}
                </h1>
                <p className="animate-auth-copy-in mb-[clamp(1.2rem,3.2vh,2.6rem)] max-w-[clamp(24rem,33vw,35rem)] text-[clamp(0.9rem,0.95vw,1.03rem)] leading-relaxed text-zinc-400">
                  {description}
                </p>

                <div className="relative h-[clamp(14.5rem,31vh,23rem)] w-full select-none">
                  <div className="auth-card-enter-left absolute left-[clamp(0rem,0.9vw,0.8rem)] top-[clamp(0rem,0.9vh,0.7rem)] w-[clamp(16rem,23vw,21rem)] rounded-2xl border border-zinc-700/50 bg-zinc-900/50 p-[clamp(0.85rem,0.95vw,1.05rem)] shadow-2xl backdrop-blur-md">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20">
                        <PenTool className="h-4 w-4 text-rose-400" />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-zinc-200">✨ 跟着阿玉总裁干！！</div>
                        <div className="text-[11px] text-zinc-500">正在同步团队灵感与大纲</div>
                      </div>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div className="absolute bottom-0 left-0 top-0 w-[65%] rounded-full bg-rose-500" />
                      <div className="animate-sweep absolute bottom-0 left-0 top-0 w-[65%] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                    </div>
                  </div>

                  <div className="auth-card-enter-right absolute left-[clamp(8.8rem,13vw,14.5rem)] top-[clamp(3.6rem,9vh,6.4rem)] z-10 w-[clamp(18rem,26vw,23rem)] rounded-2xl border border-zinc-700/50 bg-zinc-900/80 p-[clamp(0.9rem,0.95vw,1.1rem)] shadow-2xl backdrop-blur-xl">
                    <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                        <span className="text-[12px] font-medium text-zinc-300">团队协作动态</span>
                      </div>
                      <span className="font-mono text-[10px] uppercase text-zinc-500">实时同步</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-zinc-400">最新视觉资产文件</span>
                        <span className="flex items-center font-mono text-emerald-400">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          已上传云端
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-zinc-400">云端自动化处理流</span>
                        <span className="flex items-center font-mono text-amber-400">
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          正在处理中
                          <span className="ml-0.5 flex w-2 text-left">
                            <span className="animate-blink-dot" style={{ animationDelay: "0s" }}>
                              .
                            </span>
                            <span className="animate-blink-dot" style={{ animationDelay: "0.2s" }}>
                              .
                            </span>
                            <span className="animate-blink-dot" style={{ animationDelay: "0.4s" }}>
                              .
                            </span>
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pb-[clamp(0.25rem,0.8vh,0.6rem)] pt-[clamp(0.55rem,1.2vh,0.95rem)]">
              <div className="text-[12px] font-medium tracking-wide text-zinc-500">© 2026 Helloview Team. All rights reserved.</div>
            </div>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto bg-white p-6">
          <div className="relative z-10 flex w-full justify-center">{children}</div>
        </div>
      </div>
    </div>
  );
}
