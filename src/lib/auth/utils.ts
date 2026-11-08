export const EMAIL_DOMAIN = "omi.local";

/**
 * Transforms an employee ID to the internal email format.
 * @param employeeId The employee ID (e.g. "16022")
 * @returns The email address (e.g. "16022@omi.local")
 */
export function employeeIdToEmail(employeeId: string): string {
    return `${employeeId}@${EMAIL_DOMAIN}`;
}

/**
 * Extracts the employee ID from an internal email address.
 * @param email The email address
 * @returns The employee ID or null if invalid format
 */
export function emailToEmployeeId(email: string | null | undefined): string | null {
    if (!email) return null;
    const [id, domain] = email.split("@");
    if (domain !== EMAIL_DOMAIN) return null;
    return id;
}

/**
 * 管理員只認 Firebase Auth custom claim `admin: true`（只有 Admin SDK 能設，見 scripts/createAdmin.ts）。
 * 不看 email 字串、也不看 users/{uid}.employeeId（後者是使用者註冊時自己寫的）。
 * 2026-11-08 security-audit 修正。
 */
export function isAdminClaims(claims: Record<string, unknown> | null | undefined): boolean {
    return claims?.admin === true;
}

/**
 * Returns the user's designation based on their total points.
 * @param points Total points accumulated
 * @returns The title string (e.g. "急診R1", "院長")
 */
export function getDesignation(points: number): string {
    if (points >= 2000) return "院長";      // Was 5000
    if (points >= 1000) return "副院長";    // Was 2000
    if (points >= 500) return "急診主任";    // Was 1000
    if (points >= 300) return "急診主治醫師"; // Was 500
    if (points >= 150) return "急診總醫師";   // Was 350
    if (points >= 80) return "急診R4";     // Was 200
    if (points >= 40) return "急診R3";     // Was 100
    if (points >= 20) return "急診R2";     // Was 50
    return "急診R1";
}
