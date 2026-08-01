"use client";

import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  className?: string;
  appName: string;
}

export const Button = ({ children, className, appName }: ButtonProps) => {
  return (
    <button
      className={[
        "inline-flex h-12 cursor-pointer items-center justify-center rounded-full border border-transparent px-5 font-sans text-base font-medium leading-5 transition-colors",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => alert(`Hello from your ${appName} app!`)}
    >
      {children}
    </button>
  );
};
