type BrandedLoaderProps = {
  label?: string;
  fullscreen?: boolean;
};

export function BrandedLoader({
  label = 'Loading…',
  fullscreen = false,
}: BrandedLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullscreen
          ? 'fixed inset-0 z-[100] grid place-items-center bg-[#f7f7f1]/90 backdrop-blur-md'
          : 'grid min-h-52 place-items-center rounded-3xl bg-white/70 p-10'
      }
    >
      <div className="text-center">
        <span className="relative mx-auto grid size-20 place-items-center rounded-full bg-[#d9ff62]/30 shadow-[0_0_0_10px_rgba(217,255,98,.14)]">
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-r-[#17251d] border-t-[#78d11f]" />
          <img
            src="/coverdesk-logo.png"
            alt=""
            className="size-14 animate-[spin_2.4s_linear_infinite] rounded-full object-cover"
          />
        </span>
        <p className="mt-6 text-sm font-semibold text-[#17251d]">{label}</p>
        <p className="mt-1 text-xs text-black/40">Preparing your workspace</p>
      </div>
    </div>
  );
}
