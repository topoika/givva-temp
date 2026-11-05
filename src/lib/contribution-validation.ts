export const phonePattern = "(?:\\+254|254|0)[17][0-9]{8}";

export function validContributionPhone(value: unknown): value is string {
  return typeof value === "string" && new RegExp(`^${phonePattern}$`).test(value);
}
