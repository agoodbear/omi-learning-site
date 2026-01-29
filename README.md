# OMI Learning Site (Phase 1)

This is the OMI Learning Site project (ECG Teaching).
Phase 1 focuses on the Foundation: Authentication, User Profiles, and Access Control (Admin Guard).

## Prerequisites
- Node.js 18+
- Firebase Project (Auth, Firestore)
- Service Account Key (for admin script)

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to `.env.local` and fill in your Firebase credentials.
   ```bash
   cp .env.example .env.local
   ```
   *Required Variables:*
   - Firebase config keys (API Key, Project ID, etc.)
   - `NEXT_PUBLIC_ADMIN_EMPLOYEE_IDS`: Comma-separated list of admin IDs (default: 16022).

3. **Firebase Setup**
   - Enable **Authentication** (Email/Password provider).
   - Enable **Firestore Database** (Start in Test mode or Production mode).
   - Deploy Rules:
     ```bash
     npx firebase-tools deploy --only firestore:rules
     ```
     (Or copy contents of `firestore.rules` to Firebase Console).

4. **Service Account (For Admin Script)**
   - Go to Project Settings > Service Accounts.
   - Generate new private key.
   - Save as `service-account-key.json` in the project root.

## Running Locally

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

## Creating Admin Account

To bootstrap the admin user (ID: 16022), run the script:

```bash
# Make sure service-account-key.json exists or GOOGLE_APPLICATION_CREDENTIALS is set
npx tsx scripts/createAdmin.ts
```

This will:
1. Create a Firebase Auth user (`16022@omi.local` / `12345678`).
2. Create a Firestore profile in `users/{uid}` with `role: 'admin'`.

## Verification (Phase 1)

### 1. User Flow (Manual)
1. Go to `/signup`.
2. Register with a random ID (e.g. `99999`) and password.
3. You should be redirected to Home (`/`).
4. Verify you see "Role: User".
5. Try to access `/admin` -> You should be shown a 403 Forbidden page or redirected.

### 2. Admin Flow (Manual)
1. Run the `createAdmin.ts` script.
2. Go to `/login`.
3. Login with `16022` / `12345678`.
4. Verify you see "Role: Admin".
5. Click the "Admin" link in Navbar or go to `/admin`.
6. You should see the Admin Dashboard.
