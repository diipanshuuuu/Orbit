import { CreateAdminZoneBody } from "@workspace/api-zod";

export const adminZoneInput = CreateAdminZoneBody.transform((input) => ({
  ...input, name: input.name.trim(), units: input.units.map((label) => label.trim()),
})).superRefine((input, ctx) => {
  const issue = (message: string, path: string[]) => ctx.addIssue({ code: "custom", message, path });
  if (!input.name) issue("Enter a zone name.", ["name"]);
  if (input.low_max >= input.high_min) issue("High threshold must exceed the low threshold.", ["high_min"]);
  if (Boolean(input.active_start) !== Boolean(input.active_end)) issue("Set both active-hour times, or leave both blank.", ["active_end"]);
  if (input.active_start && input.active_start === input.active_end) issue("Start and end must be different; leave both blank for all day.", ["active_end"]);
  if (input.units.some((label) => !label)) issue("Unit labels cannot be blank.", ["units"]);
  if (new Set(input.units).size !== input.units.length) issue("Unit labels must be unique.", ["units"]);
});

export function utcCounterDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}
