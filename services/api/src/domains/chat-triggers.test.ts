import { describe, expect, it } from "vitest"

import {
  CHAT_TRIGGERS,
  CHAT_TRIGGER_IDS,
  CHAT_TRIGGER_TOOLTIP_DEFAULT,
  DEFAULT_CHAT_TRIGGER,
  isChatTrigger,
  chatTriggerLabel,
  resolveChatTrigger,
  resolveChatTriggerConfig,
  chatTriggerConfigSchema,
} from "@repo/api/domains/chat-triggers"

describe("resolveChatTrigger", () => {
  it("keeps a known trigger", () => {
    expect(resolveChatTrigger("default")).toBe("default")
    expect(resolveChatTrigger("bubble")).toBe("bubble")
    expect(resolveChatTrigger("orb")).toBe("orb")
    expect(resolveChatTrigger("pill")).toBe("pill")
  })

  it("trims whitespace", () => {
    expect(resolveChatTrigger("  orb  ")).toBe("orb")
  })

  it("fails open to the default", () => {
    // A row written before triggers existed, or by hand: unknown ids must
    // never leave a customer's website without a launcher.
    expect(resolveChatTrigger(undefined)).toBe(DEFAULT_CHAT_TRIGGER)
    expect(resolveChatTrigger(null)).toBe(DEFAULT_CHAT_TRIGGER)
    expect(resolveChatTrigger("")).toBe(DEFAULT_CHAT_TRIGGER)
    expect(resolveChatTrigger("hologram")).toBe(DEFAULT_CHAT_TRIGGER)
    expect(resolveChatTrigger(42)).toBe(DEFAULT_CHAT_TRIGGER)
  })
})

describe("isChatTrigger", () => {
  it("accepts only registered ids", () => {
    expect(isChatTrigger("default")).toBe(true)
    expect(isChatTrigger("pill")).toBe(true)
    expect(isChatTrigger("Orb")).toBe(false)
    expect(isChatTrigger("hologram")).toBe(false)
  })
})

describe("the registry", () => {
  it("lists the default trigger first, so it is the fallback", () => {
    expect(CHAT_TRIGGER_IDS[0]).toBe(DEFAULT_CHAT_TRIGGER)
  })

  it("gives every trigger a label and a description", () => {
    for (const trigger of CHAT_TRIGGERS) {
      expect(trigger.label.length).toBeGreaterThan(0)
      expect(trigger.description.length).toBeGreaterThan(0)
    }
  })

  it("has unique ids", () => {
    expect(new Set(CHAT_TRIGGER_IDS).size).toBe(CHAT_TRIGGER_IDS.length)
  })
})

describe("chatTriggerLabel", () => {
  it("names a known trigger", () => {
    expect(chatTriggerLabel("pill")).toBe("Labeled pill")
    expect(chatTriggerLabel("orb")).toBe("Glass orb")
  })

  it("names the fallback for an unknown trigger", () => {
    expect(chatTriggerLabel("hologram")).toBe(
      chatTriggerLabel(DEFAULT_CHAT_TRIGGER),
    )
  })
})

describe("chatTriggerConfigSchema", () => {
  it("accepts a valid bag", () => {
    const parsed = chatTriggerConfigSchema.safeParse({
      label: " Ask us anything ",
      iconSource: "logo",
      tooltip: "Ask us anything",
      tooltipVisibility: "always",
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.label).toBe("Ask us anything")
      expect(parsed.data.iconSource).toBe("logo")
    }
  })

  it("refuses unknown keys — the update API does not silently store them", () => {
    expect(
      chatTriggerConfigSchema.safeParse({ animation: "wobble" }).success,
    ).toBe(false)
  })

  it("refuses tooltips beyond 32 characters", () => {
    expect(
      chatTriggerConfigSchema.safeParse({ tooltip: "x".repeat(33) }).success,
    ).toBe(false)
  })

  it("refuses an empty tooltip", () => {
    expect(chatTriggerConfigSchema.safeParse({ tooltip: "   " }).success).toBe(
      false,
    )
  })
})

describe("resolveChatTriggerConfig", () => {
  it("fills every key when nothing is stored", () => {
    // Existing installs resolve to tooltip hidden, exactly what they had
    // before this feature.
    expect(resolveChatTriggerConfig(undefined)).toEqual({
      label: CHAT_TRIGGER_TOOLTIP_DEFAULT,
      iconSource: "chat-icon",
      tooltip: CHAT_TRIGGER_TOOLTIP_DEFAULT,
      tooltipVisibility: "never",
    })
  })

  it("tolerates junk rows with defaults at read time", () => {
    expect(
      resolveChatTriggerConfig({ tooltipVisibility: "sometimes", oops: true }),
    ).toEqual(resolveChatTriggerConfig(undefined))
  })

  it("keeps owner choices", () => {
    expect(
      resolveChatTriggerConfig({
        label: "Book a demo",
        iconSource: "logo",
        tooltip: "Questions? Ask away",
        tooltipVisibility: "hover",
      }),
    ).toEqual({
      label: "Book a demo",
      iconSource: "logo",
      tooltip: "Questions? Ask away",
      tooltipVisibility: "hover",
    })
  })
})
