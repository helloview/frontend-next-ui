import Image from "next/image";

type BrandLogoProps = {
  logoSrc?: string;
  className?: string;
  textClassName?: string;
  markClassName?: string;
  logoClassName?: string;
  logoSize?: number;
  withText?: boolean;
};

function BrandLogoBase({
  logoSrc = "/logo.svg",
  className = "",
  textClassName = "",
  markClassName = "",
  logoClassName = "",
  logoSize = 24,
  withText = true,
  animated = false,
}: BrandLogoProps & { animated: boolean }) {
  const wordmarkSize = Math.max(12, Math.round(logoSize * 0.96));
  const markSize = Math.max(10, Math.round(logoSize * 0.6));

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`inline-flex items-center justify-center ${animated ? "logo-mark-animated" : ""} ${markClassName}`}>
        <Image
          src={logoSrc}
          alt="Helloview Logo"
          width={markSize}
          height={markSize}
          priority={animated}
          className={logoClassName}
        />
      </span>
      {withText ? (
        <span
          className={`inline-flex items-center font-logo-pixel tracking-tight text-zinc-900 ${animated ? "logo-wordmark-animated" : ""} ${textClassName}`}
          style={{ fontSize: `${wordmarkSize}px`, lineHeight: `${logoSize}px` }}
        >
          Helloview
        </span>
      ) : null}
    </div>
  );
}

export function BrandLogo(props: BrandLogoProps) {
  return <BrandLogoBase {...props} animated={false} />;
}

export function BrandLogoAnimated(props: BrandLogoProps) {
  return <BrandLogoBase {...props} animated />;
}
