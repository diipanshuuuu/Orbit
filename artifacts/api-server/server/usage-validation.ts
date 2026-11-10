import { LogUsageEventBody } from "@workspace/api-zod";

export const usageEventInput = LogUsageEventBody.transform((input) => ({
  ...input,
  source: input.source?.replace(/[\u0000-\u001f\u007f]/g, "").trim() || null,
  action: input.action?.replace(/[\u0000-\u001f\u007f]/g, "").trim() || null,
})).superRefine((input, ctx) => {
  if (input.event_type === "button_tap" && !input.action) {
    ctx.addIssue({ code: "custom", message: "Button taps need an action label.", path: ["action"] });
  }
  if (input.event_type === "page_view" && input.action !== null) {
    ctx.addIssue({ code: "custom", message: "Page views cannot include a button action.", path: ["action"] });
  }
});
