import type { AppRole } from "../drizzle/schema";

export const roleCapabilities: Record<AppRole, readonly string[]> = {
  patient: ["patient:home", "iop:upload:self", "iop:view:self", "dose:sync:self", "dose:view:self", "device:view:self"],
  physician: ["patient:queue", "iop:view:any", "iop:exclude", "target:set", "prescription:create", "device:manage"],
  educator: ["education:manage"],
  admin: ["patient:queue", "iop:view:any", "iop:exclude", "target:set", "prescription:create", "device:manage", "member:manage", "audit:view"],
};

export function hasRole(role: AppRole, allowedRoles: readonly AppRole[]) {
  return allowedRoles.includes(role);
}

export function hasCapability(role: AppRole, capability: string) {
  return roleCapabilities[role].includes(capability);
}
