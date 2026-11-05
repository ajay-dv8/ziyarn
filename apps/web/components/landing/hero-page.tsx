"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";

import { Button } from "@repo/ui/components/button";
import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";
import TextType from "@/components/common/text-type";
import Link from "next/link";

import { APP_ROUTES } from "@/constants/routes";

type PresetType =
  | "fade"
  | "slide"
  | "scale"
  | "blur"
  | "blur-slide"
  | "zoom"
  | "flip"
  | "bounce"
  | "rotate"
  | "swing";

type AnimatedGroupProps = {
  children: ReactNode;
  className?: string;
  variants?: {
    container?: Variants;
    item?: Variants;
  };
  preset?: PresetType;
};

const defaultContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const defaultItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const presetVariants: Record<
  PresetType,
  { container: Variants; item: Variants }
> = {
  fade: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    },
  },
  slide: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    },
  },
  scale: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { opacity: 1, scale: 1 },
    },
  },
  blur: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, filter: "blur(4px)" },
      visible: { opacity: 1, filter: "blur(0px)" },
    },
  },
  "blur-slide": {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, filter: "blur(4px)", y: 20 },
      visible: { opacity: 1, filter: "blur(0px)", y: 0 },
    },
  },
  zoom: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, scale: 0.5 },
      visible: {
        opacity: 1,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      },
    },
  },
  flip: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, rotateX: -90 },
      visible: {
        opacity: 1,
        rotateX: 0,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      },
    },
  },
  bounce: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: -50 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 400, damping: 10 },
      },
    },
  },
  rotate: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, rotate: -180 },
      visible: {
        opacity: 1,
        rotate: 0,
        transition: { type: "spring", stiffness: 200, damping: 15 },
      },
    },
  },
  swing: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, rotate: -10 },
      visible: {
        opacity: 1,
        rotate: 0,
        transition: { type: "spring", stiffness: 300, damping: 8 },
      },
    },
  },
};

function AnimatedGroup({ children, className, variants, preset }: AnimatedGroupProps) {
  const fallback = { container: defaultContainerVariants, item: defaultItemVariants };
  const selectedVariants = preset ? (presetVariants[preset] ?? fallback) : fallback;
  const containerVariants = variants?.container || selectedVariants.container;
  const itemVariants = variants?.item || selectedVariants.item;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={cn(className)}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export { AnimatedGroup };

export default function HeroPage() {
  const transitionVariants: { item: Variants } = {
    item: {
      hidden: {
        opacity: 0,
        filter: "blur(12px)",
        y: 12,
      },
      visible: {
        opacity: 1,
        filter: "blur(0px)",
        y: 0,
        transition: {
          type: "spring",
          bounce: 0.3,
          duration: 1.5,
        },
      },
    },
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center px-6 py-20 text-white">
      {/* Background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero/background.webp"
        alt="Background"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-black/40" />

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center">

        <div className="max-w-5xl">
          <h1 className="mx-auto mb-6  text-center text-4xl font-semibold leading-tight tracking-tight md:text-7xl">
          Ziyarn engages your customers, {" "}
        </h1>
        <span className="text-3xl font-semibold">& handles your:{" "}</span>
          <TextType
            as="span"
            className="text-3xl font-semibold"
            text={["sales", "email marketing", "help desk", "bookings"]}
            textColors={["#4ade80"]}
            cursorColor="#4ade80"
            typingSpeed={75}
            pauseDuration={1500}
            deletingSpeed={50}
            typeEffect="fade"
            cursorStyle="bar"
            cursorGlide
          />
        </div>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
          <Button
            variant="outline"
            className="rounded-2xl border-4 border-white/30 bg-white/10 p-5 text-xl text-white backdrop-blur-md transition hover:bg-white/20"
            onClick={() =>
              document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Explore More
          </Button>

          <Button
            variant="outline"
            render={<Link href={APP_ROUTES.SIGN_UP} />}
            className="rounded-2xl border-4 border-white/30 bg-white/10 p-5 text-xl text-white backdrop-blur-md transition hover:bg-white/20"
          >
            Get Started
          </Button>
        </div>

        <AnimatedGroup
          variants={{
            container: {
              visible: {
                transition: {
                  staggerChildren: 0.05,
                  delayChildren: 0.75,
                },
              },
            },
            ...transitionVariants,
          }}
        >
          <div className="relative -mr-56 mt-6 overflow-hidden px-2 sm:mr-0 sm:mt-8 md:mt-16">
            <div
              aria-hidden
              className="absolute inset-0 z-10 bg-gradient-to-b from-transparent from-35% to-background"
            />
            <div className="bg-background ring-background inset-shadow-2xs relative mx-auto max-w-6xl overflow-hidden rounded-2xl border p-4 shadow-lg shadow-zinc-950/15 ring-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="border-border/25 aspect-15/8 relative z-2 rounded-2xl border"
                src="/hero/app-screen.png"
                alt="app screen"
                width="2700"
                height="1440"
              />
            </div>
          </div>
        </AnimatedGroup>
      </div>
    </div>
  );
}
