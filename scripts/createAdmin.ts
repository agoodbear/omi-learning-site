import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env.local (or .env)
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env

const ADMIN_ID = process.env.NEXT_PUBLIC_ADMIN_EMPLOYEE_IDS?.split(',')[0].trim() || "16022";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "12345678";
const EMAIL_DOMAIN = "omi.local";

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account-key.json";

function getServiceAccount() {
    try {
        if (fs.existsSync(serviceAccountPath)) {
            return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
        }
    } catch (e) {
        // Ignore
    }
    return null;
}

async function main() {
    const serviceAccount = getServiceAccount();

    if (!serviceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.error("Error: Service account not found. Please set GOOGLE_APPLICATION_CREDENTIALS or place service-account-key.json in root.");
        process.exit(1);
    }

    const app = !getApps().length
        ? initializeApp({
            credential: serviceAccount ? cert(serviceAccount) : undefined,
        })
        : getApps()[0];

    const auth = getAuth(app);
    const db = getFirestore(app);

    const email = `${ADMIN_ID}@${EMAIL_DOMAIN}`;

    console.log(`Setting up Admin User: ${ADMIN_ID} (${email})...`);

    let uid = "";

    try {
        const userRecord = await auth.getUserByEmail(email);
        uid = userRecord.uid;
        console.log("User already exists inside Auth.");
    } catch (e: any) {
        if (e.code === "auth/user-not-found") {
            console.log("Creating new Auth user...");
            const newUser = await auth.createUser({
                email,
                password: ADMIN_PASSWORD,
                displayName: "Admin",
            });
            uid = newUser.uid;
            console.log("Auth user created.");
        } else {
            console.error("Error checking auth user:", e);
            process.exit(1);
        }
    }

    // Create/Update Firestore Profile with role: 'admin'
    console.log(`Updating Firestore profile for ${uid}...`);
    await db.collection("users").doc(uid).set(
        {
            uid,
            employeeId: ADMIN_ID,
            role: "admin",
            updatedAt: new Date(),
        },
        { merge: true }
    );

    console.log("✅ Admin setup complete!");
    console.log(`Login with: ${ADMIN_ID} / ${ADMIN_PASSWORD}`);
}

main();
