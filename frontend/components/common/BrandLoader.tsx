import Image from "next/image";

interface BrandLoaderProps {
  /** What is happening, announced to screen readers and shown under the logo. */
  message?: string;
  /** `screen`: fixed full-viewport overlay (session / portal boot). `inline`: fills its box. */
  variant?: "screen" | "inline";
}

/**
 * GateSphere branded loading state — logo in a pulsing ring, wordmark, indeterminate progress.
 *
 * Used while there is nothing meaningful to lay out yet (resolving the session before a
 * portal renders). Once the page structure is known, use skeletons instead (`PageSkeleton`).
 * Fades in after 150 ms so an instant cache hit never flashes it; honours
 * `prefers-reduced-motion`. Styles live in `globals.css` (`.gs-brand-loader*`).
 */
export function BrandLoader({
  message = "Loading your workspace…",
  variant = "screen",
}: BrandLoaderProps) {
  return (
    <div
      className={`gs-brand-loader gs-brand-loader--${variant}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="gs-brand-loader__mark">
        <span className="gs-brand-loader__ring" aria-hidden="true" />
        <span className="gs-brand-loader__orbit" aria-hidden="true" />
        <Image
          src="/images/gatesphere-logo.webp"
          alt=""
          width={64}
          height={64}
          priority
          className="gs-brand-loader__logo"
        />
      </div>
      <div className="gs-brand-loader__wordmark" aria-hidden="true">
        GateSphere
      </div>
      <div className="gs-brand-loader__bar" aria-hidden="true">
        <span />
      </div>
      <p className="gs-brand-loader__message">{message}</p>
    </div>
  );
}
