"use client";

import { MeshGradient, PulsingBorder } from "@paper-design/shaders-react";
import { motion } from "framer-motion";
import Link from "next/link";

import { APP_ROUTES } from "@/constants/routes";
import { HeroChat } from "@/components/landing/hero-chat";

const MotionLink = motion.create(Link);

// Deterministic spark offsets: random values during render would mismatch
// between the server-rendered HTML and the client hydration pass.
const SPARKS = [
  { left: "28%", top: "34%", drift: 8 },
  { left: "52%", top: "22%", drift: -6 },
  { left: "68%", top: "46%", drift: 5 },
  { left: "41%", top: "58%", drift: -8 },
  { left: "74%", top: "28%", drift: 6 },
  { left: "60%", top: "66%", drift: -5 },
];

export default function ShaderShowcase() {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <svg className="absolute inset-0 w-0 h-0">
        <defs>
          <filter id="glass-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence baseFrequency="0.005" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.02
                      0 1 0 0 0.02
                      0 0 1 0 0.05
                      0 0 0 0.9 0"
              result="tint"
            />
          </filter>
          <filter id="gooey-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="gooey"
            />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
          <filter id="logo-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="text-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <MeshGradient
        className="absolute inset-0 w-full h-full"
        colors={["#000000", "#06b6d4", "#0891b2", "#164e63", "#f97316"]}
        speed={0.3}
      />
      <MeshGradient
        className="absolute inset-0 w-full h-full opacity-60"
        colors={["#000000", "#ffffff", "#06b6d4", "#f97316"]}
        speed={0.2}
      />

      {/* Legibility scrims: the mesh sits mid-tone where the nav and copy go. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.28) 45%, transparent)",
        }}
      />

      <header className="relative z-20 flex items-center justify-between p-6">
        <motion.div
          className="flex items-center group cursor-pointer"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <span
            className="relative z-10 text-2xl font-black tracking-tight text-white drop-shadow-lg"
            style={{ filter: "url(#logo-glow)" }}
          >
            Ziyarn
          </span>

          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            {SPARKS.map((spark, sparkIndex) => (
              <motion.div
                key={sparkIndex}
                className="absolute w-1 h-1 bg-white/60 rounded-full"
                style={{ left: spark.left, top: spark.top }}
                animate={{
                  y: [-10, -20, -10],
                  x: [0, spark.drift, 0],
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: sparkIndex * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Navigation */}
        <nav className="flex items-center space-x-2">
          <Link
            href={APP_ROUTES.FEATURES}
            className="text-white/80 hover:text-white text-sm font-light px-3 py-2 rounded-full hover:bg-white/10 transition-all duration-200"
          >
            Features
          </Link>
          <Link
            href={APP_ROUTES.PRICING}
            className="text-white/80 hover:text-white text-sm font-light px-3 py-2 rounded-full hover:bg-white/10 transition-all duration-200"
          >
            Pricing
          </Link>
          <Link
            href={APP_ROUTES.DOCS}
            className="text-white/80 hover:text-white text-sm font-light px-3 py-2 rounded-full hover:bg-white/10 transition-all duration-200"
          >
            Docs
          </Link>
        </nav>

        {/* Login Button Group with Arrow */}
        <div
          className="relative flex items-center group"
          style={{ filter: "url(#gooey-filter)" }}
        >
          <Link
            href={APP_ROUTES.SIGN_IN}
            aria-hidden="true"
            tabIndex={-1}
            className="absolute right-0 px-2.5 py-2 rounded-full bg-white text-black font-normal text-xs transition-all duration-300 hover:bg-white/90 cursor-pointer h-8 flex items-center justify-center -translate-x-10 group-hover:-translate-x-19 z-0"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 17L17 7M17 7H7M17 7V17"
              />
            </svg>
          </Link>
          <Link
            href={APP_ROUTES.SIGN_IN}
            className="px-6 py-2 rounded-full bg-white text-black font-normal text-sm transition-all duration-300 hover:bg-white/90 cursor-pointer h-8 flex items-center z-10"
          >
            Login
          </Link>
        </div>
      </header>

      {/* HERO TEXT (TITLE) */}
      <div className="absolute inset-x-0 top-16 bottom-0 z-20 flex items-center justify-between gap-8 px-6 sm:px-10 xl:px-40">
        <div className="max-w-2xl text-left">
          <motion.h1
            className="text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-none tracking-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <motion.span
              className="block font-light text-white/90 text-4xl md:text-5xl lg:text-6xl mb-2 tracking-wider"
              style={{
                background:
                  "linear-gradient(135deg, #ffffff 0%, #06b6d4 30%, #f97316 70%, #ffffff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "url(#text-glow)",
              }}
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                duration: 8,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
            >
              One agent
            </motion.span>
            <span className="block font-black text-white drop-shadow-2xl">
              for support
            </span>
            <span className="block font-light text-white/80 italic">
              and sales.
            </span>
          </motion.h1>

          <motion.p
            className="text-lg font-light text-white/70 mb-8 leading-relaxed max-w-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            It answers, books, sells, and hands off the moment a human matters.
          </motion.p>

          <motion.div
            className="flex items-center gap-6 flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
          >
            <MotionLink
              href="#how-it-works"
              className="px-10 py-4 rounded-full bg-transparent border-2 border-white/30 text-white font-medium text-sm transition-all duration-300 hover:bg-white/10 hover:border-cyan-400/50 hover:text-cyan-100 cursor-pointer backdrop-blur-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              See how it works
            </MotionLink>
            <MotionLink
              href={APP_ROUTES.SIGN_UP}
              className="px-10 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-orange-500 text-white font-semibold text-sm transition-all duration-300 hover:from-cyan-400 hover:to-orange-400 cursor-pointer shadow-lg hover:shadow-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Start free
            </MotionLink>
          </motion.div>
        </div>

        {/* CHAT */}

        <div className="hidden w-[38rem] shrink-0 xl:block">
          <HeroChat />
        </div>
      </div>

      <div className="absolute bottom-10 right-10 z-30 hidden md:block">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <PulsingBorder
            colors={[
              "#06b6d4",
              "#0891b2",
              "#f97316",
              "#00FF88",
              "#FFD700",
              "#FF6B35",
              "#ffffff",
            ]}
            colorBack="#00000000"
            speed={1.5}
            roundness={1}
            thickness={0.1}
            softness={0.2}
            intensity={5}
            spots={5}
            spotSize={0.1}
            pulse={0.1}
            smoke={0.5}
            smokeSize={4}
            scale={0.65}
            rotation={0}
            frame={9161408.251009725}
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
            }}
          />

          {/* Rotating text around the pulsing border */}
          <motion.svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            animate={{ rotate: 360 }}
            transition={{
              duration: 20,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            style={{ transform: "scale(1.6)" }}
            aria-hidden="true"
          >
            <defs>
              <path
                id="hero-orbit-path"
                d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"
              />
            </defs>
            <text className="text-sm fill-white/80 font-medium">
              <textPath href="#hero-orbit-path" startOffset="0%">
                Ziyarn • answers • books • sells • handoff • Ziyarn •
              </textPath>
            </text>
          </motion.svg>
        </div>
      </div>
    </div>
  );
}
