import { type JSX } from "react";

export function Code({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <code
      className={[
        "rounded-md bg-black/5 px-1.5 py-0.5 font-mono text-sm font-semibold dark:bg-white/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </code>
  );
}
