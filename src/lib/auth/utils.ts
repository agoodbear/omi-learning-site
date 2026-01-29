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
 * Checks if a given employee ID is an admin based on environment variables.
 * @param employeeId The employee ID to check
 * @returns true if admin, false otherwise
 */
export function isAdmin(employeeId: string): boolean {
    const adminIds = (process.env.NEXT_PUBLIC_ADMIN_EMPLOYEE_IDS || "")
        .split(",")
        .map((id) => id.trim());
    return adminIds.includes(employeeId);
}
