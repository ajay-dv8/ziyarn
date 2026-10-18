"use client"

import * as React from "react"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/card"
import { Button } from "@repo/ui/components/button"
import { Switch } from "@repo/ui/components/switch"
import { Check, X } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"

export interface PlanFeature {
  label: string
  included: boolean
}

export interface PricingPlan {
  id: string
  name: string
  description: string
  /** Optional. Rendered above the plan name when present. */
  icon?: React.ReactNode
  /** Monthly price in whole currency units. */
  priceMonthly: number
  /** Yearly price in whole currency units, when annual billing is offered. */
  priceYearly?: number
  /** Rendered before the price, e.g. "GHS " or "$". */
  currencySymbol?: string
  /** Replaces the price entirely, e.g. "Custom". */
  priceLabel?: string
  /** Small line under the price. */
  priceNote?: string
  /** One-line summary shown above the feature list. */
  summary?: string
  features: PlanFeature[]
  recommended?: boolean
  /** Overrides the button text for this plan. */
  actionLabel?: string
  /** Where the button sends the visitor. Omit for a plan with no action yet. */
  actionHref?: string
  /**
   * Renders the card full width below the grid. Used for the entry tier, so
   * the paid plans get the row to themselves without the free plan looking
   * like an afterthought.
   */
  wide?: boolean
}

export interface PricingModuleProps {
  title?: string
  subtitle?: string
  annualBillingLabel?: string
  buttonLabel?: string
  plans: PricingPlan[]
  defaultAnnual?: boolean
  /**
   * Annual billing needs prices for both periods. When any plan has no yearly
   * price the toggle is hidden rather than showing a price nobody is charged.
   */
  showBillingToggle?: boolean
  className?: string
}

/**
 * The pricing grid: one card per plan, each listing its own features with the
 * ones it does not include struck through, so the difference between two tiers
 * is readable without a comparison table.
 *
 * Everything about a plan — names, prices, features, the button target — is
 * passed in. The module renders it and owns nothing else, so the same
 * component can show a plan set on the pricing page, inside the dashboard, or
 * in a campaign.
 *
 * REARRANGING A CARD
 * ------------------
 * Every part of a card is built as its own block below, then placed in the
 * markup further down. To move a part, move the block that renders it:
 *
 *   titleBlock    — the plan name and its description
 *   iconBlock     — the optional icon, above the name
 *   priceBlock    — the price, its currency and the note under it
 *   actionBlock   — the button
 *   summaryBlock  — the one-line summary above the features
 *   featuresBlock — the list of features, checked and crossed out
 *
 * The wide card (the one that spans the full row below) has its own layout in
 * the same function, so a change to the narrow card does not move the wide one
 * by accident.
 */
export function PricingModule({
  title = "Pricing Plans",
  subtitle = "Choose a plan that fits your needs.",
  annualBillingLabel = "Annual billing",
  buttonLabel = "Get started",
  plans,
  defaultAnnual = false,
  showBillingToggle,
  className,
}: PricingModuleProps) {
  const [isAnnual, setIsAnnual] = React.useState(defaultAnnual)

  const annualAvailable =
    showBillingToggle ?? plans.every((plan) => typeof plan.priceYearly === "number")

  const widePlans = plans.filter((plan) => plan.wide)
  const rowPlans = plans.filter((plan) => !plan.wide)

  const renderCard = (plan: PricingPlan) => {
    const yearly = isAnnual && typeof plan.priceYearly === "number"
    const price = (yearly ? plan.priceYearly : plan.priceMonthly) ?? 0
    const priceText = plan.priceLabel ?? `${plan.currencySymbol ?? ""}${price.toLocaleString()}`

    // ---- Icon (optional, sits above the plan name) ----
    const iconBlock = plan.icon ? (
      <div className={cn(!plan.wide && "flex justify-center")}>{plan.icon}</div>
    ) : null

    // ---- Plan title and description ----
    const titleBlock = (
      <div className="w-full flex items-start flex-col gap-1 mb-8">
        <div
          className={cn(
            "flex items-center gap-2",
            !plan.wide && "justify-center"
          )}
        >
          <CardTitle className="text-xl">{plan.name}</CardTitle>
        </div>
        <CardDescription>{plan.description}</CardDescription>
      </div>
    )

    // ---- Price ----
    const priceBlock = (
      <div className={cn("shrink-0", plan.wide ? "sm:text-right" : "text-left flex items-baseline gap-1")}>
        <p className="text-3xl font-semibold tracking-tight">{priceText}</p>
        <p className="text-sm text-muted-foreground">
          {plan.priceNote ?? (plan.priceLabel ? "" : `/ ${yearly ? "year" : "month"}`)}
        </p>
      </div>
    )

    // ---- Action button ----
    const actionBlock = plan.actionHref ? (
      <Button
        className={cn("w-full", plan.wide && "sm:w-48 sm:shrink-0")}
        variant={plan.recommended ? "default" : "outline"}
        render={<a href={plan.actionHref} />}
      >
        {plan.actionLabel ?? buttonLabel}
      </Button>
    ) : null

    // ---- Summary line (omit a plan's summary by leaving it unset) ----
    const summaryBlock = plan.summary ? (
      <p className="text-sm text-muted-foreground">{plan.summary}</p>
    ) : null

    // ---- Feature list ----
    // One item per line, always: the list reads as a single baseline, so a
    // plan's list can be scanned straight down.
    const featuresBlock = (
      <ul className="mt-8 space-y-2 text-sm">
        {plan.features.map((feature) => (
          <li key={feature.label} className="flex items-start gap-2">
            {feature.included ? (
              <Check
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            ) : (
              <X
                className="mt-0.5 size-4 shrink-0 text-muted-foreground/50"
                aria-hidden="true"
              />
            )}
            <span
              className={
                feature.included
                  ? "text-foreground/80"
                  : "text-muted-foreground/30 line-through"
              }
            >
              {feature.label}
            </span>
          </li>
        ))}
      </ul>
    )

    return (
      // The wrapper is the grid item, so the "Recommended" pill can sit on the
      // card's top border: the card clips its own overflow, so a pill placed
      // inside it would be cut in half.
      <div
        key={plan.id}
        data-slot="pricing-plan-wrapper"
        className={cn("relative", plan.wide && "sm:col-span-2 lg:col-span-4")}
      >
        {/* ---- "Recommended" pill, centred on the card's top border ---- */}
        {plan.recommended && (
          <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-sm">
            Recommended
          </span>
        )}

        <Card
          data-slot="pricing-plan"
          data-plan={plan.id}
          className={cn(
            "relative flex h-full flex-col border-border transition-all hover:border-primary/30 hover:shadow-md",
            plan.recommended && "border-primary ring-2 ring-primary/80 lg:scale-[1.02]"
          )}
        >
        {/* WIDE CARD LAYOUT (the full-width card below the row).
            Laptop and up: three columns — title, price + button, features.
            Mobile: one column — title with the price beside it, the feature
            list, then the button last. */}
        {plan.wide ? (
          <div className="md:grid grid-cols-3 md:px-4">
            <CardHeader className="grid-cols-[1fr_auto] items-start gap-4 sm:gap-8 md:flex md:flex-col">
              <div className="flex items-start gap-3">
                {iconBlock}
                {titleBlock}
              </div>

              <div className="flex flex-col items-start gap-3">
                {priceBlock}

                {/* Button beside the price on laptop and up. */}
                <div className="hidden md:block">
                  {actionBlock && (
                    <div className="w-48 shrink-0">{actionBlock}</div>
                  )}
                </div>
              </div>
            </CardHeader>
            {/* The feature list: one item per line, on a single baseline. */}
            <CardContent className="col-span-2 flex items-baseline sm:flex sm:items-start sm:gap-8">
              <div className="min-w-0 flex-1 sm:order-1">
                {summaryBlock}
                {featuresBlock}
              </div>
              {/* On mobile the button comes after the list. */}
              {actionBlock && (
                <div className="sm:order-2 sm:w-48 sm:shrink-0 md:hidden">{actionBlock}</div>
              )}
            </CardContent>
          </div>
        ) : (
          /* NARROW CARD LAYOUT (the cards in the row).
             Order here: icon, title, price, button, summary, features. */
          <>
            <CardHeader>
              <div
                className={cn(
                  "flex items-start gap-3",
                  "flex-col items-center text-center"
                )}
              >
                {iconBlock}
                {titleBlock}
              </div>
              {priceBlock}
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              {actionBlock}
              <div className="min-w-0 flex-1">
                {summaryBlock}
                {featuresBlock}
              </div>
            </CardContent>
          </>
        )}
        </Card>
      </div>
    )
  }

  return (
    <section className={cn("w-full text-foreground", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        {/* ---- Page heading ---- */}
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            {subtitle}
          </p>
        </div>

        {/* ---- Monthly / annual toggle (hidden when no yearly prices) ---- */}
        {annualAvailable && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Switch
              id="pricing-billing-toggle"
              checked={isAnnual}
              onCheckedChange={(checked: boolean) => setIsAnnual(checked)}
            />
            <label
              htmlFor="pricing-billing-toggle"
              className="cursor-pointer text-sm text-muted-foreground"
            >
              {annualBillingLabel}
            </label>
          </div>
        )}

        {/* ---- The row of plan cards ---- */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {rowPlans.map(renderCard)}
        </div>

        {/* ---- The full-width card(s) below the row ---- */}
        {widePlans.length > 0 && (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {widePlans.map(renderCard)}
          </div>
        )}
      </div>
    </section>
  )
}
