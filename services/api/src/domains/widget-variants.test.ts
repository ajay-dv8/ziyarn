import { describe, expect, it } from "vitest"

import {
  DEFAULT_WIDGET_VARIANT,
  WIDGET_VARIANTS,
  WIDGET_VARIANT_IDS,
  isWidgetVariant,
  resolveWidgetVariant,
  widgetVariantLabel,
} from "@repo/api/domains/widget-variants"

describe("resolveWidgetVariant", () => {
  it("keeps a known variant", () => {
    expect(resolveWidgetVariant("glow")).toBe("glow")
    expect(resolveWidgetVariant("classic")).toBe("classic")
  })

  it("trims whitespace", () => {
    expect(resolveWidgetVariant("  glow  ")).toBe("glow")
  })

  it("fails open to the default", () => {
    // An embed snippet written before variants existed has no data-variant,
    // and a typo must never leave a customer with a blank widget.
    expect(resolveWidgetVariant(undefined)).toBe(DEFAULT_WIDGET_VARIANT)
    expect(resolveWidgetVariant(null)).toBe(DEFAULT_WIDGET_VARIANT)
    expect(resolveWidgetVariant("")).toBe(DEFAULT_WIDGET_VARIANT)
    expect(resolveWidgetVariant("hologram")).toBe(DEFAULT_WIDGET_VARIANT)
    expect(resolveWidgetVariant(42)).toBe(DEFAULT_WIDGET_VARIANT)
  })
})

describe("isWidgetVariant", () => {
  it("accepts only registered ids", () => {
    expect(isWidgetVariant("classic")).toBe(true)
    expect(isWidgetVariant("glow")).toBe(true)
    expect(isWidgetVariant("Glow")).toBe(false)
    expect(isWidgetVariant("hologram")).toBe(false)
  })
})

describe("the registry", () => {
  it("lists the classic widget first, so it is the fallback", () => {
    expect(WIDGET_VARIANT_IDS[0]).toBe(DEFAULT_WIDGET_VARIANT)
  })

  it("gives every variant a label and a description", () => {
    for (const variant of WIDGET_VARIANTS) {
      expect(variant.label.length).toBeGreaterThan(0)
      expect(variant.description.length).toBeGreaterThan(0)
    }
  })
})

describe("widgetVariantLabel", () => {
  it("names a known variant", () => {
    expect(widgetVariantLabel("glow")).toBe("Glow")
  })

  it("names the fallback for an unknown variant", () => {
    expect(widgetVariantLabel("hologram")).toBe(
      widgetVariantLabel(DEFAULT_WIDGET_VARIANT),
    )
  })
})
