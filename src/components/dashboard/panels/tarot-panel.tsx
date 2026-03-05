"use client";

import { useEffect, useRef, useState } from "react";

type TarotCard = {
  id: number;
  name: string;
  type: string;
  art: string;
};

type ThemeConfig = {
  id: string;
  name: string;
  primary: string;
  primaryRGB: string;
  title: string;
  titleStyle: string;
  btnStart: string;
  btnReset: string;
  faceOuter: string;
  faceInner: string;
  textNum: string;
  textName: string;
  textSub: string;
};

type Phase = "start" | "zero_gravity" | "cascade_shuffle" | "spread" | "focus" | "reveal" | "done";

type GsapLike = {
  set: (targets: unknown, vars: Record<string, unknown>) => void;
  to: (targets: unknown, vars: Record<string, unknown>) => void;
  killTweensOf: (targets: unknown) => void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const TAROT_DECK: TarotCard[] = [
  { id: 0, name: "愚者 (The Fool)", type: "0", art: "from-[#e2e8f0] to-[#cbd5e1] mix-blend-multiply" },
  { id: 1, name: "魔术师 (The Magician)", type: "I", art: "from-[#fef08a] to-[#fcd34d] mix-blend-multiply" },
  { id: 2, name: "女祭司 (The High Priestess)", type: "II", art: "from-[#bfdbfe] to-[#93c5fd] mix-blend-multiply" },
  { id: 3, name: "女皇 (The Empress)", type: "III", art: "from-[#fbcfe8] to-[#f472b6] mix-blend-multiply" },
  { id: 4, name: "皇帝 (The Emperor)", type: "IV", art: "from-[#fca5a5] to-[#ef4444] mix-blend-multiply" },
  { id: 5, name: "教皇 (The Hierophant)", type: "V", art: "from-[#fed7aa] to-[#fdba74] mix-blend-multiply" },
  { id: 6, name: "恋人 (The Lovers)", type: "VI", art: "from-[#e9d5ff] to-[#d8b4fe] mix-blend-multiply" },
  { id: 7, name: "战车 (The Chariot)", type: "VII", art: "from-[#cbd5e1] to-[#94a3b8] mix-blend-multiply" },
  { id: 8, name: "力量 (Strength)", type: "VIII", art: "from-[#fed7aa] to-[#fb923c] mix-blend-multiply" },
  { id: 9, name: "隐士 (The Hermit)", type: "IX", art: "from-[#99f6e4] to-[#5eead4] mix-blend-multiply" },
  { id: 10, name: "命运之轮 (Wheel of Fortune)", type: "X", art: "from-[#bae6fd] to-[#7dd3fc] mix-blend-multiply" },
  { id: 11, name: "正义 (Justice)", type: "XI", art: "from-[#fecdd3] to-[#fda4af] mix-blend-multiply" },
  { id: 12, name: "倒吊人 (The Hanged Man)", type: "XII", art: "from-[#a5f3fc] to-[#67e8f9] mix-blend-multiply" },
  { id: 13, name: "死神 (Death)", type: "XIII", art: "from-[#d1d5db] to-[#6b7280] mix-blend-multiply" },
  { id: 14, name: "节制 (Temperance)", type: "XIV", art: "from-[#a7f3d0] to-[#6ee7b7] mix-blend-multiply" },
  { id: 15, name: "恶魔 (The Devil)", type: "XV", art: "from-[#fecaca] to-[#dc2626] mix-blend-multiply" },
  { id: 16, name: "高塔 (The Tower)", type: "XVI", art: "from-[#ffedd5] to-[#fdba74] mix-blend-multiply" },
  { id: 17, name: "星星 (The Star)", type: "XVII", art: "from-[#e0f2fe] to-[#bae6fd] mix-blend-multiply" },
  { id: 18, name: "月亮 (The Moon)", type: "XVIII", art: "from-[#ede9fe] to-[#c4b5fd] mix-blend-multiply" },
  { id: 19, name: "太阳 (The Sun)", type: "XIX", art: "from-[#fef08a] to-[#fde047] mix-blend-multiply" },
  { id: 20, name: "审判 (Judgement)", type: "XX", art: "from-[#e4e4e7] to-[#a1a1aa] mix-blend-multiply" },
  { id: 21, name: "世界 (The World)", type: "XXI", art: "from-[#d1fae5] to-[#6ee7b7] mix-blend-multiply" },
];

const POSITIONS = ["本源", "羁绊", "转折", "终焉"];

const THEMES: Record<string, ThemeConfig> = {
  gold: {
    id: "gold",
    name: "古典金",
    primary: "#c5a059",
    primaryRGB: "197, 160, 89",
    title: "玉的塔罗牌",
    titleStyle: "text-3xl md:text-4xl tracking-[0.3em]",
    btnStart: "开启诗篇",
    btnReset: "重新翻阅",
    faceOuter: "#e2d5c3",
    faceInner: "#d1c4b2",
    textNum: "#8c7b64",
    textName: "#4a4a4a",
    textSub: "#a39b8e",
  },
  jade: {
    id: "jade",
    name: "温润玉",
    primary: "#74a593",
    primaryRGB: "116, 165, 147",
    title: "玉的塔罗牌",
    titleStyle: "text-3xl md:text-4xl tracking-[0.2em]",
    btnStart: "开启玉轴",
    btnReset: "重置命盘",
    faceOuter: "#c0d0c9",
    faceInner: "#aabdb6",
    textNum: "#658779",
    textName: "#4a4a4a",
    textSub: "#89a399",
  },
};

type ThemeKey = keyof typeof THEMES;

function shuffleDeck(): TarotCard[] {
  const next = [...TAROT_DECK];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function getGSAP(): GsapLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  const maybe = (window as Window & { gsap?: GsapLike }).gsap;
  return maybe ?? null;
}

export function TarotPanel() {
  const [phase, setPhase] = useState<Phase>("start");
  const [deck, setDeck] = useState<TarotCard[]>([]);
  const [drawn, setDrawn] = useState<TarotCard[]>([]);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [gsapLoaded, setGsapLoaded] = useState(false);
  const [zoomedCardId, setZoomedCardId] = useState<number | null>(null);
  const [themeKey, setThemeKey] = useState<ThemeKey>("gold");
  const [layoutSeed, setLayoutSeed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const cardsRef = useRef<Array<HTMLDivElement | null>>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const t = THEMES[themeKey];

  useEffect(() => {
    if (getGSAP()) {
      const timer = window.setTimeout(() => {
        setGsapLoaded(true);
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }

    const onLoad = () => {
      setGsapLoaded(true);
    };
    const existing = document.querySelector('script[data-gsap-cdn="true"]') as HTMLScriptElement | null;
    if (existing) {
      if (getGSAP()) {
        const timer = window.setTimeout(() => {
          setGsapLoaded(true);
        }, 0);
        return () => {
          window.clearTimeout(timer);
        };
      }
      existing.addEventListener("load", onLoad);
      return () => {
        existing.removeEventListener("load", onLoad);
      };
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
    script.async = true;
    script.dataset.gsapCdn = "true";
    script.addEventListener("load", onLoad);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", onLoad);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDeck(shuffleDeck());
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const doc = document as FullscreenDocument;
      const active = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(active);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!gsapLoaded || deck.length === 0) {
      return;
    }

    const gsap = getGSAP();
    if (!gsap) {
      return;
    }

    const cardElements = cardsRef.current.filter((item): item is HTMLDivElement => Boolean(item));
    if (cardElements.length === 0) {
      return;
    }

    if (phase === "start") {
      gsap.killTweensOf(cardElements);
      gsap.set(cardElements, {
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: 0,
        scale: 0,
        rotation: 0,
        opacity: 0,
      });

      cardElements.forEach((card) => {
        const wrapper = card.querySelector(".card-3d-wrapper");
        if (!wrapper) {
          return;
        }
        gsap.killTweensOf(wrapper);
        gsap.set(wrapper, { rotationY: 0, rotationX: 0, z: 0 });
      });

      gsap.to(cardElements, {
        scale: 1,
        opacity: 1,
        rotation: () => (Math.random() - 0.5) * 40,
        x: () => (Math.random() - 0.5) * 60,
        y: () => (Math.random() - 0.5) * 60,
        duration: 1.2,
        ease: "back.out(1.5)",
        stagger: 0.05,
      });
    }

    if (phase === "zero_gravity") {
      gsap.to(cardElements, {
        x: () => (Math.random() - 0.5) * window.innerWidth * 1.5,
        y: () => (Math.random() - 0.5) * window.innerHeight * 1.5,
        rotation: () => (Math.random() - 0.5) * 720,
        rotationX: () => (Math.random() - 0.5) * 360,
        rotationY: () => (Math.random() - 0.5) * 360,
        z: () => (Math.random() - 0.5) * 1200,
        duration: 2.5,
        ease: "expo.out",
      });

      gsap.to(cardElements, {
        x: "+=50",
        y: "+=80",
        z: "+=150",
        rotation: "+=20",
        rotationX: "+=30",
        rotationY: "+=20",
        duration: 4,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        delay: 0.5,
        stagger: {
          each: 0.05,
          from: "random",
        },
      });
    }

    if (phase === "cascade_shuffle") {
      gsap.killTweensOf(cardElements);
      gsap.to(cardElements, {
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotation: (i: number) => (i % 2 === 0 ? 5 : -5),
        duration: 1.2,
        ease: "power4.inOut",
        stagger: { each: 0.03, from: "edges" },
      });
    }

    if (phase === "spread") {
      gsap.killTweensOf(cardElements);
      const total = deck.length;

      cardsRef.current.forEach((card, i) => {
        if (!card || !deck[i]) return;
        const current = deck[i];
        const drawnIndex = drawn.findIndex((item) => item.id === current.id);

        if (drawnIndex !== -1) {
          const slotWidth = Math.min(window.innerWidth * 0.82, 860);
          const step = slotWidth / 4;
          const startX = -(slotWidth / 2) + step / 2 + drawnIndex * step;
          gsap.to(card, {
            x: startX,
            y: Math.min(window.innerHeight * 0.2, 140),
            rotation: 0,
            rotationX: 0,
            rotationY: 0,
            z: 0,
            scale: 1.16,
            opacity: 1,
            zIndex: 160 + drawnIndex,
            duration: 0.65,
            ease: "power3.out",
          });
          return;
        }

        const progress = i / Math.max(total - 1, 1);
        const xOffset = (progress - 0.5) * (window.innerWidth > 800 ? 800 : window.innerWidth * 0.85);
        const yOffset = Math.pow((progress - 0.5) * 2, 2) * 120;
        const rot = (progress - 0.5) * 55;

        gsap.to(card, {
          x: xOffset,
          y: yOffset - 50,
          rotation: rot,
          rotationX: 0,
          rotationY: 0,
          z: 0,
          scale: 1,
          duration: 1.5,
          ease: "power3.out",
          delay: i * 0.04,
        });
      });
    }

    if (phase === "focus" || phase === "reveal" || phase === "done") {
      gsap.killTweensOf(cardElements);

      cardsRef.current.forEach((card, i) => {
        if (!card || !deck[i]) {
          return;
        }

        const current = deck[i];
        const isDrawn = drawn.some((item) => item.id === current.id);

        if (!isDrawn) {
          gsap.to(card, {
            y: window.innerHeight + 200,
            rotation: (Math.random() - 0.5) * 90,
            rotationX: 0,
            rotationY: 0,
            z: 0,
            opacity: 0,
            duration: 1.5,
            ease: "power2.in",
            delay: Math.random() * 0.3,
          });
          return;
        }

        const drawnIndex = drawn.findIndex((item) => item.id === current.id);
        if (drawnIndex === -1) {
          return;
        }

        const isZoomed = zoomedCardId === current.id;
        const isOtherZoomed = zoomedCardId !== null && !isZoomed;

        if (isZoomed) {
          gsap.to(card, {
            x: 0,
            y: -20,
            rotation: 0,
            rotationX: 0,
            rotationY: 0,
            z: 0,
            scale: window.innerWidth < 768 ? 2.2 : 2.6,
            opacity: 1,
            zIndex: 300,
            duration: 0.6,
            ease: "expo.out",
          });
          return;
        }

        if (isOtherZoomed) {
          gsap.to(card, {
            scale: 0.9,
            opacity: 0,
            rotation: 0,
            rotationX: 0,
            rotationY: 0,
            z: 0,
            zIndex: 0,
            duration: 0.4,
            ease: "power2.out",
          });
          return;
        }

        const slotWidth = Math.min(window.innerWidth * 0.8, 800);
        const step = slotWidth / 4;
        const startX = -(slotWidth / 2) + step / 2 + drawnIndex * step;

        gsap.to(card, {
          x: startX,
          y: -30,
          rotation: 0,
          rotationX: 0,
          rotationY: 0,
          z: 0,
          scale: 1.35,
          opacity: 1,
          zIndex: 100 + drawnIndex,
          duration: 0.8,
          ease: "expo.out",
          delay: 0.1,
        });
      });
    }
  }, [phase, deck, drawn, gsapLoaded, zoomedCardId]);

  useEffect(() => {
    if (!gsapLoaded || (phase !== "reveal" && phase !== "done")) {
      return;
    }
    const gsap = getGSAP();
    if (!gsap) {
      return;
    }

    revealed.forEach((cardID) => {
      const cardIndex = deck.findIndex((item) => item.id === cardID);
      if (cardIndex < 0) {
        return;
      }

      const card = cardsRef.current[cardIndex];
      if (!card) {
        return;
      }

      gsap.set(card, { rotation: 0, rotationX: 0, rotationY: 0, z: 0 });
      const wrapper = card.querySelector(".card-3d-wrapper");
      if (wrapper) {
        gsap.set(wrapper, { rotationY: 180, rotationX: 0, rotation: 0, z: 0 });
      }
    });
  }, [deck, gsapLoaded, phase, revealed]);

  const handleStart = () => {
    if (phase !== "start") {
      return;
    }

    setPhase("zero_gravity");
    window.setTimeout(() => setPhase("cascade_shuffle"), 2800);
    window.setTimeout(() => setPhase("spread"), 4200);
  };

  const handleInteraction = (cardObj: TarotCard, domIndex: number, event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();

    const isAlreadyDrawn = drawn.some((item) => item.id === cardObj.id);

    if (phase === "spread" && !isAlreadyDrawn && drawn.length < 4) {
      const gsap = getGSAP();
      if (!gsap) {
        return;
      }

      const newDrawn = [...drawn, cardObj];
      setDrawn(newDrawn);

      const drawnIndex = newDrawn.length - 1;
      const slotWidth = Math.min(window.innerWidth * 0.8, 800);
      const step = slotWidth / 4;
      const startX = -(slotWidth / 2) + step / 2 + drawnIndex * step;

      const targetCard = cardsRef.current[domIndex];
      if (targetCard) {
        gsap.to(targetCard, {
          x: startX,
          y: Math.min(window.innerHeight * 0.2, 140),
          rotation: 0,
          rotationX: 0,
          rotationY: 0,
          z: 0,
          scale: 1.16,
          zIndex: 160 + drawnIndex,
          duration: 0.8,
          ease: "back.out(1.2)",
        });
      }

      if (newDrawn.length === 4) {
        window.setTimeout(() => setPhase("focus"), 1000);
        window.setTimeout(() => {
          setPhase("reveal");
          newDrawn.forEach((drawnCard, idx) => {
            const cardDomIndex = deck.findIndex((item) => item.id === drawnCard.id);
            window.setTimeout(() => {
              const wrapper = cardsRef.current[cardDomIndex]?.querySelector(".card-3d-wrapper");
              if (wrapper) {
                gsap.to(wrapper, {
                  rotationY: 180,
                  rotationX: 0,
                  rotation: 0,
                  z: 80,
                  duration: 1.2,
                  ease: "back.out(1.5)",
                  onComplete: () => {
                    gsap.set(wrapper, { rotationY: 180, rotationX: 0, rotation: 0, z: 0 });
                  },
                });
              }
              setRevealed((prev) => [...prev, drawnCard.id]);
            }, idx * 800);
          });
          window.setTimeout(() => setPhase("done"), 4 * 800 + 800);
        }, 2500);
      }
      return;
    }

    if ((phase === "reveal" || phase === "done") && isAlreadyDrawn) {
      setZoomedCardId(zoomedCardId === cardObj.id ? null : cardObj.id);
    }
  };

  const handleBackgroundClick = () => {
    if (zoomedCardId !== null) {
      setZoomedCardId(null);
    }
  };

  const handleReset = () => {
    const gsap = getGSAP();
    const cardElements = cardsRef.current.filter((item): item is HTMLDivElement => Boolean(item));
    if (gsap && cardElements.length > 0) {
      gsap.killTweensOf(cardElements);
      cardElements.forEach((card) => {
        gsap.set(card, { clearProps: "transform,opacity,zIndex" });
        const wrapper = card.querySelector(".card-3d-wrapper");
        if (wrapper) {
          gsap.killTweensOf(wrapper);
          gsap.set(wrapper, { rotationY: 0, rotationX: 0, z: 0 });
        }
      });
    }

    setZoomedCardId(null);
    setRevealed([]);
    setDrawn([]);
    setDeck(shuffleDeck());
    setPhase("start");
    setLayoutSeed((value) => value + 1);
  };

  const handleToggleFullscreen = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const element = containerRef.current as FullscreenElement | null;
    if (!element) {
      return;
    }

    const doc = document as FullscreenDocument;
    const active = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);

    try {
      if (active) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } else if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      }
    } catch {
      // ignore user-gesture/permissions errors from fullscreen api
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-[#0a0e17] text-[#e2d5c3] ${
        isFullscreen
          ? "h-screen min-h-screen rounded-none border-0"
          : "h-[calc(100svh-140px)] min-h-[680px] rounded-[28px] border border-zinc-200"
      }`}
      onClick={handleBackgroundClick}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600&family=Noto+Serif+SC:wght@300;400;600&display=swap');

        .tarot-root { font-family: 'Noto Serif SC', 'Cormorant Garamond', serif; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }

        :root {
          --theme-primary: ${t.primary};
          --theme-primary-rgb: ${t.primaryRGB};
        }

        .paper-texture {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E");
          pointer-events: none;
        }

        .ambient-glow {
          background: radial-gradient(circle at 50% 40%, rgba(var(--theme-primary-rgb), 0.08) 0%, transparent 60%),
                      radial-gradient(circle at 50% 100%, rgba(44, 62, 80, 0.3) 0%, transparent 80%);
        }

        .museum-vignette {
          background: radial-gradient(circle at center, transparent 20%, rgba(5, 7, 12, 0.95) 100%);
          pointer-events: none;
        }

        .elegant-underline::after {
          content: '';
          position: absolute;
          width: 100%;
          transform: scaleX(0);
          height: 1px;
          bottom: -4px;
          left: 0;
          background-color: var(--theme-primary);
          transform-origin: bottom right;
          transition: transform 0.5s ease-out;
        }

        .card-inner-hover:hover .elegant-underline::after {
          transform: scaleX(1);
          transform-origin: bottom left;
        }

        .start-btn {
          color: var(--theme-primary);
          border-color: rgba(var(--theme-primary-rgb), 0.5);
        }

        .start-btn:hover {
          background-color: rgba(var(--theme-primary-rgb), 0.1) !important;
          border-color: var(--theme-primary) !important;
          letter-spacing: 0.4em !important;
        }

        .reset-btn {
          color: #7a818c;
          border-color: transparent;
        }

        .reset-btn:hover {
          color: var(--theme-primary) !important;
          border-color: var(--theme-primary) !important;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px) translateX(-50%); }
          to { opacity: 1; transform: translateY(0) translateX(-50%); }
        }
      `}</style>

      <div className="tarot-root relative flex h-full w-full flex-col items-center justify-center">
        <div
          className={`absolute right-6 top-6 z-[100] flex items-center gap-3 transition-opacity duration-300 lg:right-10 lg:top-10 ${
            isFullscreen ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          {Object.values(THEMES).map((theme) => (
            <button
              key={theme.id}
              onClick={(event) => {
                event.stopPropagation();
                setThemeKey(theme.id as ThemeKey);
              }}
              className={`rounded-full border px-4 py-1.5 text-[10px] tracking-widest transition-all duration-700 backdrop-blur-sm md:text-xs ${
                themeKey === theme.id
                  ? "border-[var(--theme-primary)] bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] shadow-[0_0_15px_rgba(var(--theme-primary-rgb),0.3)]"
                  : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/80"
              }`}
            >
              {theme.name}
            </button>
          ))}
          <button
            onClick={handleToggleFullscreen}
            className="rounded-full border border-white/15 px-4 py-1.5 text-[10px] tracking-widest text-white/75 transition-all duration-500 hover:border-white/40 hover:bg-white/10 hover:text-white md:text-xs"
          >
            {isFullscreen ? "退出全屏" : "开启全屏"}
          </button>
        </div>

        <div className="ambient-glow absolute inset-0 z-0 transition-colors duration-1000" />
        <div className="paper-texture absolute inset-0 z-0 mix-blend-overlay" />
        <div
          className={`museum-vignette absolute inset-0 z-10 transition-opacity duration-[2s] ease-in-out ${
            phase === "focus" || phase === "reveal" || phase === "done" || zoomedCardId ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          className={`pointer-events-none absolute left-0 right-0 top-12 z-50 flex flex-col items-center justify-center transition-all duration-[2s] ${
            phase === "focus" || phase === "reveal" || zoomedCardId ? "-translate-y-6 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <h1
            className={`mb-4 font-light transition-all duration-1000 ${t.titleStyle}`}
            style={{ color: t.primary, textShadow: `0 2px 8px rgba(${t.primaryRGB}, 0.3)` }}
          >
            {t.title}
          </h1>
          <div className="mb-4 flex w-full items-center justify-center gap-4 opacity-70 transition-colors duration-1000">
            <div className="h-[1px] w-12 transition-colors duration-1000" style={{ background: `linear-gradient(to right, transparent, ${t.primary})` }} />
            <div className="h-1.5 w-1.5 rotate-45 border transition-colors duration-1000" style={{ borderColor: t.primary }} />
            <div className="h-[1px] w-12 transition-colors duration-1000" style={{ background: `linear-gradient(to left, transparent, ${t.primary})` }} />
          </div>
          <p className="text-sm font-light tracking-[0.25em] text-[#9ba3af] md:text-base">
            {phase === "start" && "静候神谕..."}
            {phase === "zero_gravity" && "打破虚空..."}
            {phase === "cascade_shuffle" && "因果交织..."}
            {phase === "spread" && `请循心之所向 ( ${drawn.length} / 4 )`}
            {phase === "focus" && "命运之线已定..."}
            {(phase === "reveal" || phase === "done") && "诗篇的启示"}
          </p>
        </div>

        <div className="relative z-20 h-full w-full max-w-[1200px] overflow-visible perspective-[1200px]">
          {deck.map((card, index) => {
            const isDrawn = drawn.some((item) => item.id === card.id);
            const isSelectable = phase === "spread" && !isDrawn;
            const isZoomable = (phase === "reveal" || phase === "done") && isDrawn;
            const isZoomed = zoomedCardId === card.id;

            let interactiveClasses = "";
            if (isSelectable) interactiveClasses = "cursor-pointer hover:z-[200] hover:-translate-y-6 hover:scale-[1.15]";
            if (isZoomable && !zoomedCardId) interactiveClasses = "cursor-zoom-in hover:-translate-y-2 hover:scale-[1.05]";
            if (isZoomed) interactiveClasses = "cursor-zoom-out";

            return (
              <div
                key={`${layoutSeed}-${card.id}`}
                ref={(element) => {
                  cardsRef.current[index] = element;
                }}
                className="absolute left-1/2 top-1/2 h-[21.5vw] w-[13vw] max-h-[157px] max-w-[95px] rounded-[2px] shadow-[0_4px_15px_rgba(0,0,0,0.2)] md:max-h-[215px] md:max-w-[130px]"
                onClick={(event) => handleInteraction(card, index, event)}
              >
                <div className={`card-inner-hover relative h-full w-full origin-bottom transition-all duration-700 ${interactiveClasses}`}>
                  <div className="card-3d-wrapper preserve-3d relative h-full w-full">
                    <div
                      className="backface-hidden absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#121622] p-2 transition-colors duration-1000"
                      style={{ borderWidth: "1px", borderColor: `rgba(${t.primaryRGB}, 0.4)` }}
                    >
                      <div className="paper-texture absolute inset-0 opacity-20" />
                      <div
                        className="relative flex h-full w-full items-center justify-center p-1 transition-colors duration-1000"
                        style={{ borderWidth: "0.5px", borderColor: `rgba(${t.primaryRGB}, 0.5)` }}
                      >
                        <div className="flex h-full w-full items-center justify-center transition-colors duration-1000" style={{ borderWidth: "0.5px", borderColor: `rgba(${t.primaryRGB}, 0.3)` }}>
                          <div className="relative flex aspect-square w-[60%] items-center justify-center opacity-80">
                            <div className="absolute h-full w-full rounded-full transition-colors duration-1000" style={{ borderWidth: "0.5px", borderColor: t.primary }} />
                            <div className="absolute h-[80%] w-[80%] rotate-45 transition-colors duration-1000" style={{ borderWidth: "0.5px", borderColor: t.primary }} />
                            <div className="absolute flex h-[40%] w-[40%] items-center justify-center rounded-full transition-colors duration-1000" style={{ borderWidth: "0.5px", borderColor: t.primary }}>
                              <div className="h-1.5 w-1.5 rounded-full transition-colors duration-1000" style={{ backgroundColor: t.primary }} />
                            </div>
                            <div className="absolute h-[0.5px] w-full transition-colors duration-1000" style={{ backgroundColor: t.primary }} />
                            <div className="absolute h-full w-[0.5px] transition-colors duration-1000" style={{ backgroundColor: t.primary }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="backface-hidden absolute inset-0 flex flex-col items-center justify-between overflow-hidden bg-[#fdfbf7] p-2 transition-colors duration-1000"
                      style={{ transform: "rotateY(180deg)", borderWidth: "1px", borderColor: t.faceOuter }}
                    >
                      <div className="paper-texture absolute inset-0 mix-blend-multiply opacity-30" />
                      <div className="pointer-events-none absolute inset-[6px] transition-colors duration-1000" style={{ borderWidth: "0.5px", borderColor: t.faceInner }} />
                      <div className="z-10 mt-1 text-[11px] font-light tracking-[0.2em] transition-colors duration-1000 md:text-sm" style={{ color: t.textNum }}>
                        {card.type}
                      </div>

                      <div className="relative mx-1 my-2 flex w-full flex-1 flex-col items-center justify-center overflow-hidden border-[0.5px] border-[#d8e2de] bg-[#f0eae1] shadow-[inset_0_0_10px_rgba(0,0,0,0.05)]">
                        <div className={`absolute inset-0 bg-gradient-to-br ${card.art} blur-[2px] opacity-80`} />
                        <div className={`absolute -left-[25%] -top-[25%] h-[150%] w-[150%] rounded-full bg-gradient-to-tr ${card.art} opacity-50 blur-[15px]`} />
                        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/60 shadow-[0_4px_15px_rgba(0,0,0,0.1)] backdrop-blur-[1px] md:h-16 md:w-16">
                          <div className="h-2 w-2 rounded-full bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                        </div>
                      </div>

                      <div className="elegant-underline z-10 mb-2 flex w-full flex-col items-center px-1">
                        <div className="w-full truncate text-center text-[10px] font-bold tracking-[0.15em] transition-colors duration-1000 md:text-xs" style={{ color: t.textName }}>
                          {card.name.split(" ")[0]}
                        </div>
                        <div className="mt-1 text-[7px] font-light uppercase tracking-[0.1em] transition-colors duration-1000 md:text-[8px]" style={{ color: t.textSub }}>
                          {card.name.split("(")[1]?.replace(")", "") || ""}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {(phase === "reveal" || phase === "done") && isDrawn && revealed.includes(card.id) ? (
                  <div
                    className={`absolute -bottom-14 left-1/2 w-max -translate-x-1/2 text-center transition-opacity duration-[1.5s] ease-out ${
                      zoomedCardId ? "opacity-0" : "animate-[fadeIn_1.5s_ease-out_forwards] opacity-100"
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <div className="mb-1 text-xs font-light tracking-[0.3em] drop-shadow-md transition-colors duration-1000 md:text-sm" style={{ color: t.primary }}>
                        {POSITIONS[drawn.findIndex((item) => item.id === card.id)]}
                      </div>
                      <div className="h-1.5 w-1.5 rotate-45 transition-colors duration-1000" style={{ borderWidth: "0.5px", borderColor: `rgba(${t.primaryRGB}, 0.5)` }} />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className={`pointer-events-none absolute bottom-20 left-1/2 z-50 transition-opacity duration-500 ${zoomedCardId ? "opacity-0" : "opacity-100"}`}>
          <button
            onClick={handleStart}
            className={`start-btn absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-[4px] border-[0.5px] bg-transparent px-10 py-3 text-sm font-light tracking-[0.3em] transition-all duration-[800ms] ${
              phase === "start" && gsapLoaded ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
            } pointer-events-auto`}
          >
            {t.btnStart}
          </button>

          <button
            onClick={handleReset}
            className={`reset-btn absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap border-b bg-transparent px-8 py-2 text-xs font-light tracking-[0.2em] transition-all duration-[1500ms] ease-out ${
              phase === "done" ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
            } pointer-events-auto`}
          >
            {t.btnReset}
          </button>
        </div>
      </div>
    </div>
  );
}
