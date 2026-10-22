/**
 * The dimmed, out-of-focus page behind Modern Sleek.
 *
 * It is scenery rather than part of the chat card, so both the design preview
 * and the iframe page can share it. `aria-hidden` and pointer-events-none keep
 * it out of the accessibility tree and the click path.
 */
export function WidgetBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute top-[6%] left-[7%] h-7 w-28 rounded-full bg-white/[0.08] blur-[2px]" />
      <div className="absolute top-[13%] left-[12%] h-3 w-40 rounded-full bg-white/[0.05] blur-[2px]" />
      <div className="absolute top-[15%] right-[7%] h-44 w-20 rounded-[24px] bg-[#34313a] blur-[8px]" />
      <div className="absolute top-[20%] right-[16%] h-28 w-12 rounded-[16px] bg-[#3a3742] blur-[7px]" />
      <div className="absolute top-[29%] right-[25%] h-20 w-8 rounded-[12px] bg-[#322f39] blur-[6px]" />
      <div className="absolute -bottom-28 left-[16%] size-72 rounded-full bg-[#2b2732] blur-[70px]" />
      <div className="absolute -bottom-20 right-[18%] size-64 rounded-full bg-[#241f2b] blur-[80px]" />
      <div className="absolute top-1/2 left-1/2 size-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7a5cff]/15 blur-[100px]" />
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
    </div>
  );
}
