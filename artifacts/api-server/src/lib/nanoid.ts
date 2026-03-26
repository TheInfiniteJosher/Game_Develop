import { randomUUID } from "crypto";

export function nanoid(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}
