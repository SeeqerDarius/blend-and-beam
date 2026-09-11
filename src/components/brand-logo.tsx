import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ inverse = false, preload = false }: { inverse?: boolean; preload?: boolean }) {
  return (
    <Link href="/" className={`brand-logo${inverse ? " brand-logo-inverse" : ""}`} aria-label="Blend & Beam home">
      <Image src="/brand/blend-beam-woven-light.webp" alt="Blend & Beam" width={1043} height={620} sizes="(max-width: 800px) 124px, 220px" preload={preload} />
    </Link>
  );
}
