# Cross-Device Document Upload System - Provider Registration

This document is the implementation playbook for adding secure cross-device provider document uploads to the MyLocalForce website.

The feature allows a provider who is completing registration on desktop to continue document capture on mobile through either SMS or QR code, while desktop sees real-time progress through Firestore snapshots.

Read this file before writing code. It is calibrated to the current repository, not a generic Firebase app.

---

## 0. Preliminary Repository Scan

### 0.1 Project Roots

The workspace contains three related applications:

```txt
c:\Users\techn\mylocalforce
  MyLocalForceApp/             React Native app plus the deployed Firebase Functions/rules project
  mylocalforceW/               Vite React website for customer/provider flows
  mylocalforcedashboard/       React admin dashboard
```

Top-level web app structure:

```txt
mylocalforceW/
  public/
    images/
  src/
    components/
    config/
    constants/
    context/
    customer/
      components/
      pages/
    data/
    hooks/
    screens/
      signup/
    services/
      firebase/
    utils/
```

Top-level React Native/backend structure:

```txt
MyLocalForceApp/
  functions/
    assets/
      images/
    backups/
    index.js
    emailService.js
    emailTemplateService.js
    notificationTemplateService.js
    pdfGenerator.js
    stripeConnect.js
    weeklyPayoutScheduler.js
  src/
    assets/
    components/
    config/
    constants/
    context/
    data/
    firebase/
    hooks/
    navigation/
    screens/
      admin/
      client/
      customer/
      payment/
      shared/
    services/
      firebase/
    utils/
```

Top-level admin dashboard structure:

```txt
mylocalforcedashboard/
  functions/
    index.js
  public/
  src/
    assets/
    components/
    constants/
    context/
    data/
    pages/
    utils/
```

### 0.2 Cloud Functions Organization

Use the backend in `MyLocalForceApp/functions`, because `MyLocalForceApp/firebase.json` deploys:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json",
    "database": "mylocalforce"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default"
    }
  ]
}
```

Current Functions conventions:

- `MyLocalForceApp/functions/index.js` is the main export file.
- It uses CommonJS: `require(...)` and `exports.functionName = ...`.
- It initializes Admin SDK once with `admin.initializeApp()`.
- It uses the named Firestore database:

```js
const FIRESTORE_DATABASE_ID = "mylocalforce";
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);
db.settings({ ignoreUndefinedProperties: true });
```

- It mixes:
  - v2 HTTPS functions: `functions.https.onRequest(...)`
  - v1 callable functions for RN compatibility: `functionsV1.https.onCall(...)`
  - v2 callable functions in at least one place: `functions.https.onCall(...)`
  - v2 Firestore triggers: `onDocumentCreated`, `onDocumentWritten`
  - v2 schedules: `onSchedule`

For this feature, prefer `functionsV1.https.onCall` for all callable functions that are used by the website, mobile browser page, and dashboard. Existing `sendOtp` and `verifyOtp` already use v1 callable functions for client SDK compatibility.

Do not create `functions/src/` unless the whole Functions project is intentionally refactored. Add feature modules at `MyLocalForceApp/functions/*.js` and register them from `MyLocalForceApp/functions/index.js`.

### 0.3 Environment Variables

Current functions use environment variables directly through `process.env`.

Existing Twilio helper in `index.js` reads:

```txt
TWILIO_SID
TWILIO_TOKEN
TWILIO_FROM
TWILIO_PHONE_NUMBER
TWILIO_VERIFY_SID
```

The new helper must support both the existing names and the requested names:

```txt
TWILIO_ACCOUNT_SID    fallback: TWILIO_SID
TWILIO_AUTH_TOKEN     fallback: TWILIO_TOKEN
TWILIO_FROM_NUMBER    fallback: TWILIO_FROM or TWILIO_PHONE_NUMBER
APP_BASE_URL
```

Current `MyLocalForceApp/functions/.gitignore` only contains:

```txt
node_modules/
*.local
```

Add `.env` and `.env.*` exclusions before adding new secrets.

The web app currently hardcodes Firebase config in `mylocalforceW/src/services/firebase/firebaseConfig.js`. It also has `mylocalforceW/.env.example`, but only for `VITE_*` app variables. Do not put Twilio credentials in the web app.

### 0.4 Existing Firestore Collection Names

Common collections in active use:

```txt
users/
users/{uid}/details/provider_onboarding
services/
categories/
categories/{categoryId}/subcategories/
bookings/
leads/
notifications/
fcmTokens/
settings/
platformSettings/
otp_verifications/
verified_emails/
providers/
transactions/
payouts/
earnings/
supportCases/
coupons/
adminTeams/
communicationTemplates/
notificationTemplates/
smsTemplates/
```

New collections required by this feature do not currently exist:

```txt
providerUploadSessions/
providerDocuments/
documentUploadSettings/
auditLogs/
```

### 0.5 Existing Firebase Storage Conventions

Current paths:

```txt
service_images/{fileName}
profile_images/{uid}_{timestamp}.jpg
categories/{...}
provider_documents/{userId}/{docType}_{timestamp}.{ext}
```

Current provider onboarding upload behavior:

- Website: `mylocalforceW/src/services/firebase/providerOnboardingService.js`
- RN app: `MyLocalForceApp/src/services/firebase/providerOnboardingService.js`
- Upload path: `provider_documents/{userId}/{docType}_{timestamp}.{ext}`
- Returns public Firebase download URLs through `getDownloadURL()`.
- Stores those URLs under `users/{uid}/details/provider_onboarding.documents`.

New feature must use:

```txt
provider-documents/{providerId}/{sessionId}/{documentType}/{side}/{safeFilename}
```

Reads must go through signed URLs from Admin SDK only. No new public download URLs.

### 0.6 Twilio Integration

Twilio is present in `MyLocalForceApp/functions/index.js` and `MyLocalForceApp/functions/package.json`.

Existing usage:

- Dependency: `twilio`
- Helper: `getTwilioClient()`
- OTP functions: `sendOtp`, `verifyOtp`
- Lead SMS has commented-out Twilio sections.

Do not add Twilio to any `src/` client app.

### 0.7 Existing Admin Role Pattern

Firestore rules consider a user admin when:

```txt
users/{uid}.roles.admin == true
or users/{uid}.role == "admin"
or users/{uid}.activeRole == "admin"
```

Some Functions also check custom claims:

```txt
context.auth.token.admin === true
context.auth.token.admin === "true"
context.auth.token.role === "admin"
```

New admin callables must support both patterns:

1. Check custom claims first.
2. Fallback to `users/{uid}` in the named `mylocalforce` database.

### 0.8 Module System

Use the module system already present in each project:

```txt
mylocalforceW/                  ES modules, React JSX, Vite
mylocalforcedashboard/          ES modules, React JS, CRA
MyLocalForceApp/functions/      CommonJS
MyLocalForceApp/src/            ES modules
```

---

## 1. Important Spec Corrections For This Repo

### 1.1 Where Each Phase Actually Belongs

The original generic spec says everything lives in one React app and `functions/src`. In this repo, implement across three roots:

```txt
Provider website UI:
  mylocalforceW/

Shared Firebase Functions, Firestore rules, Storage rules, indexes:
  MyLocalForceApp/

Admin review/settings UI:
  mylocalforcedashboard/
```

### 1.2 Mobile Upload Authentication Conflict

There is a conflict in the raw feature brief:

- It says every Cloud Function must check `context.auth` before any logic.
- It also says mobile should open a secure SMS/QR link and validate a raw token from the URL.
- A provider opening the SMS/QR link in a mobile browser will often not be signed in as the provider.
- Direct Storage uploads require `request.auth.uid == providerId` if rules are secure.

Required implementation decision:

Use the raw upload token only to bootstrap a temporary in-memory provider session on mobile.

Implementation:

1. `validateMobileUploadToken` is the only callable allowed to run without an existing provider auth session.
2. It validates the high-entropy raw token against the SHA-256 hash in Firestore.
3. If valid, it returns a Firebase custom token for the provider UID.
4. The mobile page calls `setPersistence(auth, inMemoryPersistence)` and then `signInWithCustomToken`.
5. All subsequent calls and Storage uploads run as `context.auth.uid === providerId`.
6. The raw token is kept only in React state and URL param. Never store it in browser storage.

ASSUMPTION: Anonymous or unauthenticated token validation is acceptable for this one endpoint because otherwise the SMS/QR cross-device flow cannot function without requiring the provider to log in manually on mobile.

### 1.3 Existing Onboarding Compatibility

Current provider onboarding saves profile, banking, business, document URLs, passport metadata, and driving licence metadata to:

```txt
users/{uid}/details/provider_onboarding
```

The new document upload system must not break existing approval and compliance logic.

Implementation decision:

- Keep profile/banking/business/passport/driving metadata in the existing onboarding document.
- Store uploaded binary file records in the new top-level `providerDocuments` collection.
- Add lightweight references to onboarding details:

```js
{
  documentUploadMode: "secure_v2",
  latestDocumentUploadSessionId: "<sessionId>",
  documentsMetadata: {
    passport: { status: "submitted", documentIds: ["..."] },
    resume_cv: { status: "submitted", documentIds: ["..."] }
  }
}
```

- Do not store new public download URLs in `provider_onboarding.documents`.
- Admin review must use signed URLs from `getProviderDocumentsForReview`.
- Existing legacy URL fields must remain readable until old users are migrated.
- Existing compliance triggers in `MyLocalForceApp/functions/index.js` must be updated to consider both:
  - legacy URLs in `provider_onboarding.documents`
  - new `providerDocuments` records with `status in ["submitted", "approved"]`

---

## 2. Target Architecture

### 2.1 Data Flow

Desktop provider onboarding:

```txt
ProviderOnboardingScreen
  -> MobileUploadCard
  -> createUploadSession callable
  -> raw token returned once
  -> QR shows /mobile-upload/{token}
  -> SMS sends /mobile-upload/{rotatedToken}
  -> useSessionProgress attaches Firestore onSnapshot listeners
```

Mobile browser:

```txt
/mobile-upload/:token
  -> validateMobileUploadToken callable
  -> receives session, requirements, uploadedDocuments, providerAuthToken
  -> signInWithCustomToken using inMemoryPersistence
  -> GuidedUploadFlow
  -> uploadBytesResumable to provider-documents/{providerId}/{sessionId}/...
  -> recordDocumentUpload callable
  -> submitMobileDocuments callable
```

Admin dashboard:

```txt
ClientApprovals or new Document Uploads page
  -> getDocumentUploadSettings / updateDocumentUploadSettings
  -> getProviderDocumentsForReview
  -> signed URLs generated server-side
  -> reviewProviderDocument / revokeUploadSession
```

### 2.2 Firestore Collections

Use exactly these new collections:

```txt
providerUploadSessions/   shape: UploadSession
providerDocuments/        shape: ProviderDocument
documentUploadSettings/   single doc id: "global"
auditLogs/                shape: AuditLog
```

### 2.3 Storage Paths

Use the new secure path:

```txt
provider-documents/{providerId}/{sessionId}/{documentType}/{side}/{safeFilename}
```

Do not use the legacy path for new secure uploads:

```txt
provider_documents/{userId}/{docType}_{timestamp}.{ext}
```

### 2.4 Security Invariants

Enforce these in every phase:

- No raw token stored in Firestore.
- No raw token stored in `localStorage`, `sessionStorage`, cookies, IndexedDB, or URL history mutations beyond the route itself.
- No client-generated security-sensitive session token.
- No public download URLs for new provider documents.
- No direct client Firestore writes for upload session, document records, settings, review, or audit logs.
- Use Firestore `onSnapshot`, not polling, for live desktop progress.
- Use the named Firestore database `mylocalforce`.
- Use `const` and `let`; never add `var`.
- Every exported JS function or object shape must have JSDoc.

---

## 3. Package Changes

### 3.1 Website

Modify `mylocalforceW/package.json`:

```bash
npm install qrcode.react uuid
```

Use:

- `qrcode.react` for QR rendering.
- `uuid` for client-side safe filenames.

ASSUMPTION: Client-generated `safeFilename` is not security-sensitive. It is a random object name only. The sensitive upload session token remains server-generated.

### 3.2 Functions

`MyLocalForceApp/functions/package.json` already includes `twilio`.

No new Functions dependency is required if Node `crypto.randomUUID()` is used. The app runs Node 22 per `functions/package.json`.

---

## 4. JSDoc Object Shapes

Create these files in the website because the requested feature is for the web app:

```txt
mylocalforceW/src/types/uploadSession.js
mylocalforceW/src/types/providerDocument.js
```

These files export no runtime code. They contain only JSDoc typedefs.

Also create matching JSDoc typedef blocks in the Functions helper module:

```txt
MyLocalForceApp/functions/documentUploadTypes.js
```

This keeps server-side validators documented without introducing TypeScript.

### 4.1 `mylocalforceW/src/types/uploadSession.js`

```js
/**
 * @typedef {Object} UploadSession
 * @property {string} id
 * @property {string} providerId
 * @property {string} tokenHash
 * @property {'sms'|'qr'|'both'} deliveryMethod
 * @property {'active'|'expired'|'submitted'|'revoked'} status
 * @property {string} [mobileNumber]
 * @property {import('firebase/firestore').Timestamp} expiresAt
 * @property {import('firebase/firestore').Timestamp} createdAt
 * @property {import('firebase/firestore').Timestamp} [lastSentAt]
 * @property {number} sendCount
 * @property {import('firebase/firestore').Timestamp} [resendCooldownUntil]
 * @property {string} registrationStep
 * @property {Object.<string, string>} [metadata]
 */

/**
 * @typedef {Object} DocumentUploadSettings
 * @property {boolean} smsEnabled
 * @property {boolean} qrEnabled
 * @property {boolean} desktopFallbackEnabled
 * @property {number} sessionExpiryMinutes
 * @property {number} resendCooldownSeconds
 * @property {number} maxResendCount
 * @property {DocumentRequirement[]} requirements
 */

/**
 * @typedef {Object} DocumentRequirement
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {number} order
 * @property {boolean} required
 * @property {Array<'front'|'back'|'single'|'video'>} sides
 * @property {string[]} allowedMimeTypes
 * @property {string[]} allowedExtensions
 * @property {number} maxSizeBytes
 * @property {'camera'|'file'|'video'|'any'} captureHint
 */

/**
 * @typedef {'session_created'|'sms_sent'|'qr_generated'|'upload_started'
 *   |'file_uploaded'|'file_replaced'|'session_submitted'
 *   |'session_revoked'|'admin_approved'|'admin_rejected'
 *   |'reupload_requested'} AuditAction
 */

/**
 * @typedef {Object} AuditLog
 * @property {string} id
 * @property {AuditAction} action
 * @property {string} actorId
 * @property {'provider'|'admin'|'system'} actorType
 * @property {string} [targetId]
 * @property {string} [targetCollection]
 * @property {Object.<string, *>} [metadata]
 * @property {import('firebase/firestore').Timestamp} createdAt
 * @property {string} [ipAddress]
 */
```

### 4.2 `mylocalforceW/src/types/providerDocument.js`

```js
/**
 * @typedef {Object} ProviderDocument
 * @property {string} id
 * @property {string} providerId
 * @property {string} uploadSessionId
 * @property {string} documentType
 * @property {'front'|'back'|'single'|'video'|'other'} side
 * @property {string} originalName
 * @property {string} safeFilename
 * @property {string} mimeType
 * @property {number} sizeBytes
 * @property {string} storagePath
 * @property {'desktop'|'mobile'} source
 * @property {'pending'|'in_progress'|'uploaded'|'submitted'
 *   |'approved'|'rejected'|'reupload_required'} status
 * @property {import('firebase/firestore').Timestamp} uploadedAt
 * @property {import('firebase/firestore').Timestamp} updatedAt
 * @property {string} [reviewedBy]
 * @property {import('firebase/firestore').Timestamp} [reviewedAt]
 * @property {'pending_review'|'approved'|'rejected'} [reviewStatus]
 * @property {string} [rejectionReason]
 */
```

---

## 5. Backend Implementation In `MyLocalForceApp`

### 5.1 Files To Create Or Modify

Create:

```txt
MyLocalForceApp/functions/documentUploadTypes.js
MyLocalForceApp/functions/documentUploadValidators.js
MyLocalForceApp/functions/documentUploadTokenUtils.js
MyLocalForceApp/functions/documentUploadAuditLogger.js
MyLocalForceApp/functions/documentUploadRateLimit.js
MyLocalForceApp/functions/documentUploadSmsService.js
MyLocalForceApp/functions/documentUploadCallables.js
MyLocalForceApp/functions/seedDocumentUploadSettings.js
```

Modify:

```txt
MyLocalForceApp/functions/index.js
MyLocalForceApp/functions/.gitignore
MyLocalForceApp/firestore.rules
MyLocalForceApp/storage.rules
MyLocalForceApp/firestore.indexes.json
```

Do not create `MyLocalForceApp/functions/src` unless the entire Functions project is being reorganized.

### 5.2 Function Export Registration

At the bottom of `MyLocalForceApp/functions/index.js`, require the new callable module and export each function:

```js
const documentUploadCallables = require("./documentUploadCallables");

exports.createUploadSession = documentUploadCallables.createUploadSession;
exports.sendUploadSessionSms = documentUploadCallables.sendUploadSessionSms;
exports.validateMobileUploadToken = documentUploadCallables.validateMobileUploadToken;
exports.getUploadSessionStatus = documentUploadCallables.getUploadSessionStatus;
exports.submitMobileDocuments = documentUploadCallables.submitMobileDocuments;
exports.recordDocumentUpload = documentUploadCallables.recordDocumentUpload;
exports.getDocumentUploadSettings = documentUploadCallables.getDocumentUploadSettings;
exports.updateDocumentUploadSettings = documentUploadCallables.updateDocumentUploadSettings;
exports.getProviderDocumentsForReview = documentUploadCallables.getProviderDocumentsForReview;
exports.reviewProviderDocument = documentUploadCallables.reviewProviderDocument;
exports.revokeUploadSession = documentUploadCallables.revokeUploadSession;
```

Non-obvious decision: this keeps new logic out of the already-large `index.js` while matching the existing CommonJS helper-file style.

### 5.3 Shared Backend Initialization

Inside `documentUploadCallables.js`, initialize against the same named database:

```js
const functionsV1 = require("firebase-functions");
const admin = require("firebase-admin");
const {getFirestore} = require("firebase-admin/firestore");

const FIRESTORE_DATABASE_ID = "mylocalforce";
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);
const bucket = admin.storage().bucket();
const HttpsError = functionsV1.https.HttpsError;
```

Do not call `admin.initializeApp()` in the helper module. `index.js` already does that.

Non-obvious decision: use the `functionsV1` variable name in new modules so it cannot be confused with the existing `functions` v2 import in `index.js`.

### 5.4 Token Utility

`documentUploadTokenUtils.js` must export:

```txt
generateRawToken()
hashToken(rawToken)
buildMobileUploadUrl(rawToken)
```

Rules:

- Use `crypto.randomBytes(48).toString("hex")`.
- Use SHA-256 hex digest.
- Validate token strings before hashing. Expected raw token length is 96 hex chars.
- `APP_BASE_URL` must be present before sending SMS.
- Do not log raw tokens.

### 5.5 Audit Logger

`documentUploadAuditLogger.js` must export:

```txt
buildAuditLogRef(db)
addAuditLogToBatch(batch, auditLogRef, payload)
```

All primary mutations must write audit logs in the same Firestore batch.

Audit metadata may include session IDs, document IDs, provider IDs, request source, Twilio SID, and safe filenames. Do not put raw tokens or signed URLs in audit logs.

### 5.6 Validators

`documentUploadValidators.js` must export:

```txt
assertAuthenticated(context)
assertProviderSelf(context, providerId)
assertAdmin(context, db)
normalizeCallableData(data)
validateE164Phone(phone)
validateDeliveryMethod(value)
validateDocumentUploadSettings(settings)
validateDocumentRequirement(requirement)
validateRecordDocumentUploadPayload(payload)
validateFileMetadataAgainstRequirement(payload, requirement)
```

Admin verification must support:

- `context.auth.token.role === "admin"`
- `context.auth.token.admin === true`
- `context.auth.token.admin === "true"`
- `users/{uid}.roles.admin === true`
- `users/{uid}.role === "admin"`
- `users/{uid}.activeRole === "admin"`

### 5.7 Rate Limit Helpers

`documentUploadRateLimit.js` must export:

```txt
assertSessionCreationRateLimit(db, providerId)
incrementTokenValidationAttempt(sessionRef, tokenHash)
```

Session creation:

- Query `providerUploadSessions`
- `providerId == uid`
- `createdAt > now - 1 hour`
- If count >= 3, throw `resource-exhausted`

Token validation:

- Bucket key: `Math.floor(Date.now() / 300000)`
- Path: `providerUploadSessions/{id}/validationAttempts/{bucketKey}`
- Use `FieldValue.increment(1)`
- Reject when count is greater than 10.
- Store `tokenHashPrefix`, not the full hash, in metadata if needed.

### 5.8 SMS Service

`documentUploadSmsService.js` must export:

```txt
sendSms(to, body)
```

Rules:

- Use Twilio from Functions only.
- Validate E.164 with `/^\+[1-9]\d{7,14}$/`.
- Read credentials from:
  - `TWILIO_ACCOUNT_SID || TWILIO_SID`
  - `TWILIO_AUTH_TOKEN || TWILIO_TOKEN`
  - `TWILIO_FROM_NUMBER || TWILIO_FROM || TWILIO_PHONE_NUMBER`
- Do not expose Twilio raw errors to clients.
- Return `{ sid }` to server code so the audit log can record it.
- Use `console.error` only for safe server-side diagnostics. Never log credentials or raw token URLs.

### 5.9 Callable Functions

Use `functionsV1.https.onCall(async (data, context) => { ... })`.

This matches the existing `sendOtp` and `verifyOtp` compatibility pattern.

#### `createUploadSession`

Input:

```js
{
  providerId,
  deliveryMethod,
  registrationStep,
  mobileNumber
}
```

Implementation details:

- Require auth.
- Require `context.auth.uid === providerId`.
- Validate delivery method: `sms`, `qr`, or `both`.
- Validate mobile number if delivery method includes SMS.
- Read `documentUploadSettings/global`.
- Respect `smsEnabled` and `qrEnabled` for new sessions.
- Enforce max 3 sessions per provider per hour.
- Revoke active sessions for the same provider and registration step.
- Generate raw token server-side.
- Store only token hash.
- Write session and audit log in one batch.
- Return raw token once:

```js
{
  sessionId,
  rawToken,
  expiresAt
}
```

Also return a serializable ISO string version if the web code wants simple date parsing:

```js
{
  expiresAtIso: expiresAt.toDate().toISOString()
}
```

#### `sendUploadSessionSms`

Input:

```js
{ sessionId, providerId }
```

Implementation details:

- Require auth.
- Require provider ownership.
- Fetch `documentUploadSettings/global`.
- If SMS has been disabled after session creation, reject resend with `failed-precondition`. Existing already-sent sessions remain valid.
- Reject expired/revoked/submitted sessions.
- Enforce cooldown and max resend count.
- Rotate token on every resend.
- Build URL with `APP_BASE_URL`.
- Send SMS.
- Update session and audit log in one batch.
- Return:

```js
{
  sent: true,
  cooldownUntil,
  expiresAt
}
```

#### `validateMobileUploadToken`

Input:

```js
{ token }
```

Implementation details:

- This is the sole unauthenticated bootstrap callable.
- Validate raw token shape before hashing.
- Query by `tokenHash`.
- If not found, throw `not-found`.
- Apply failed-attempt rate limiting when token hash maps to a session.
- Reject expired/revoked/submitted with precise error codes.
- Fetch `documentUploadSettings/global`.
- Fetch all `providerDocuments` for the session.
- Create a Firebase custom token for `providerId` with claim:

```js
{
  uploadSessionId: sessionId,
  uploadTokenValidated: true
}
```

- Return:

```js
{
  sessionId,
  providerId,
  requirements,
  uploadedDocuments,
  status,
  providerAuthToken
}
```

Do not return the token hash.

#### `getUploadSessionStatus`

Input:

```js
{ sessionId, providerId }
```

Implementation details:

- Require auth.
- Require provider ownership.
- Return session plus matching `providerDocuments`.
- Used for initial desktop hydration only. Desktop then switches to `onSnapshot`.

#### `recordDocumentUpload`

Input:

```js
{
  sessionId,
  documentType,
  side,
  originalName,
  safeFilename,
  mimeType,
  sizeBytes,
  storagePath,
  source
}
```

Implementation details:

- Require auth.
- Fetch session.
- Require `context.auth.uid === session.providerId`.
- Require active session and not expired.
- Fetch settings and find matching requirement by `documentType`.
- Validate side is allowed by the requirement.
- Validate MIME type, extension, size, and storage path.
- Storage path must exactly match:

```txt
provider-documents/{providerId}/{sessionId}/{documentType}/{side}/{safeFilename}
```

- Fetch Storage metadata with `bucket.file(storagePath).getMetadata()`.
- Reject if the object does not exist.
- Compare server-read metadata against the payload:
  - `metadata.size` must match `sizeBytes`.
  - `metadata.contentType` must match `mimeType`.
  - the safe filename extension must be allowed.
- Treat Storage metadata as the trusted source. The callable payload is only a client claim until verified.
- Check whether a record exists for `sessionId + documentType + side`.
- If yes, update existing doc and audit `file_replaced`.
- If no, create new doc and audit `file_uploaded`.
- Set:

```js
{
  status: "uploaded",
  reviewStatus: "pending_review",
  uploadedAt,
  updatedAt
}
```

- Do not delete the old file when replacing. Last write wins by `updatedAt`.
- Return `{ documentId }`.

#### `submitMobileDocuments`

Input:

```js
{ sessionId, token }
```

Implementation details:

- Require auth after mobile custom-token sign-in.
- Re-validate raw token without incrementing validation attempts.
- Require session belongs to `context.auth.uid`.
- Load settings.
- Fetch provider documents for session.
- For every required requirement, require at least one uploaded document for each required side.
- If missing, return:

```js
{
  success: false,
  missing: ["Passport", "Resume / CV"]
}
```

- If complete, batch:
  - session `status = "submitted"`
  - all uploaded docs `status = "submitted"`
  - onboarding doc merge fields:

```js
{
  documentUploadMode: "secure_v2",
  latestDocumentUploadSessionId: sessionId,
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
}
```

  - audit log `session_submitted`

Important onboarding workflow rule:

- `submitMobileDocuments` submits only the document upload session.
- It must not mark the whole provider onboarding application as pending by itself, because the desktop page still owns profile, banking, business, passport number, and driving licence metadata that currently live in React state until the desktop final submit.
- The desktop final submit must call `saveProviderDetailsWithSecureDocuments` after document session completion. That is where top-level fields such as `onboardingDocuments`, `onboardingSubmittedAt`, `approvalStatus`, and `status` are updated.
- For future admin reupload flows, use a separate `registrationStep` such as `provider_onboarding_reupload` and explicitly handle top-level review-state updates for that flow.

#### Admin Callables

Admin callables:

```txt
getDocumentUploadSettings
updateDocumentUploadSettings
getProviderDocumentsForReview
reviewProviderDocument
revokeUploadSession
```

All must call `assertAdmin(context, db)` before any read/write except input normalization.

`getProviderDocumentsForReview` must generate signed URLs with 1-hour expiry:

```js
await bucket.file(storagePath).getSignedUrl({
  action: "read",
  expires: Date.now() + 60 * 60 * 1000
});
```

Never store or audit signed URLs.

### 5.10 Firestore Indexes

Modify `MyLocalForceApp/firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "providerUploadSessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "providerId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "providerDocuments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "providerId", "order": "ASCENDING" },
        { "fieldPath": "uploadSessionId", "order": "ASCENDING" },
        { "fieldPath": "uploadedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "providerDocuments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "reviewStatus", "order": "ASCENDING" },
        { "fieldPath": "uploadedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

If existing indexes are added before this feature, merge arrays instead of replacing.

### 5.11 Firestore Rules

Modify `MyLocalForceApp/firestore.rules`.

Add helper:

```txt
function isOwner(providerId) {
  return isAuthenticated() && request.auth.uid == providerId;
}
```

Add matches before the catch-all rule:

```txt
match /providerUploadSessions/{sessionId} {
  allow read: if isOwner(resource.data.providerId) || isAdmin();
  allow write: if false;

  match /validationAttempts/{attemptId} {
    allow read, write: if false;
  }
}

match /providerDocuments/{documentId} {
  allow read: if isOwner(resource.data.providerId) || isAdmin();
  allow write: if false;
}

match /documentUploadSettings/{settingId} {
  allow read: if isAuthenticated();
  allow write: if false;
}

match /auditLogs/{auditId} {
  allow read: if isAdmin();
  allow write: if false;
}
```

Keep existing rules for legacy collections until the app is fully migrated.

### 5.12 Storage Rules

Modify `MyLocalForceApp/storage.rules`.

Keep public reads for `service_images` and `categories`.

Inside the existing bucket match, add the secure new provider document path:

```txt
match /provider-documents/{providerId}/{sessionId}/{documentType}/{side}/{safeFilename} {
  allow write: if request.auth != null
    && request.auth.uid == providerId
    && request.resource.size < 250 * 1024 * 1024
    && (
         request.resource.contentType.matches('image/.*')
      || request.resource.contentType.matches('video/.*')
      || request.resource.contentType == 'application/pdf'
      || request.resource.contentType == 'application/msword'
      || request.resource.contentType.matches('application/vnd\\.openxmlformats.*')
    );
  allow read: if false;
}
```

Important:

- The verification video default max is 200 MB, so the storage rule must not be 50 MB if videos are required.
- Server validation still enforces per-document requirement size from `documentUploadSettings/global`.
- Storage rules can only enforce broad MIME and size constraints. The `recordDocumentUpload` callable must still verify the exact requirement by reading Storage metadata server-side.
- Legacy `provider_documents/{userId}/...` currently allows public read/write/delete. Do not leave this open long-term. In the first feature release, avoid breaking legacy users by not deleting the block immediately. In the follow-up migration, restrict legacy reads and move existing documents to signed URL review.

### 5.13 Seed Settings

Create `MyLocalForceApp/functions/seedDocumentUploadSettings.js`.

Run from:

```bash
cd MyLocalForceApp/functions
node seedDocumentUploadSettings.js
```

Use the named database `mylocalforce`.

Seed `documentUploadSettings/global` with:

```js
const defaultSettings = {
  smsEnabled: true,
  qrEnabled: true,
  desktopFallbackEnabled: true,
  sessionExpiryMinutes: 60,
  resendCooldownSeconds: 120,
  maxResendCount: 5,
  requirements: [
    {
      id: "passport",
      label: "Passport",
      description: "Upload the photo page of your passport.",
      order: 1,
      required: true,
      sides: ["single"],
      allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".pdf"],
      maxSizeBytes: 10 * 1024 * 1024,
      captureHint: "camera"
    },
    {
      id: "driving_licence",
      label: "Driving Licence",
      description: "Upload both sides of your driving licence.",
      order: 2,
      required: false,
      sides: ["front", "back"],
      allowedMimeTypes: ["image/jpeg", "image/png"],
      allowedExtensions: [".jpg", ".jpeg", ".png"],
      maxSizeBytes: 10 * 1024 * 1024,
      captureHint: "camera"
    },
    {
      id: "resume_cv",
      label: "Resume / CV",
      description: "Upload your current CV or resume.",
      order: 3,
      required: true,
      sides: ["single"],
      allowedMimeTypes: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ],
      allowedExtensions: [".pdf", ".doc", ".docx"],
      maxSizeBytes: 10 * 1024 * 1024,
      captureHint: "file"
    },
    {
      id: "certificates",
      label: "Professional Certificates",
      description: "Upload any relevant certifications.",
      order: 4,
      required: false,
      sides: ["single"],
      allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".pdf"],
      maxSizeBytes: 10 * 1024 * 1024,
      captureHint: "camera"
    },
    {
      id: "verification_video",
      label: "Verification Video",
      description: "Record a short video to verify your identity.",
      order: 5,
      required: true,
      sides: ["video"],
      allowedMimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
      allowedExtensions: [".mp4", ".mov", ".webm"],
      maxSizeBytes: 200 * 1024 * 1024,
      captureHint: "video"
    }
  ]
};
```

ASSUMPTION: The current business flow wants passport, resume, and video required. The existing web page currently treats certificates as required and verification video as optional; the new settings collection becomes the source of truth.

---

## 6. Website Implementation In `mylocalforceW`

### 6.1 Files To Create Or Modify

Create:

```txt
mylocalforceW/src/types/uploadSession.js
mylocalforceW/src/types/providerDocument.js

mylocalforceW/src/services/firebase/uploadSessionService.js
mylocalforceW/src/services/firebase/providerDocumentService.js
mylocalforceW/src/services/firebase/secureDocumentStorageService.js
mylocalforceW/src/services/firebase/documentSettingsService.js

mylocalforceW/src/hooks/useUploadSession.js
mylocalforceW/src/hooks/useDocumentUpload.js
mylocalforceW/src/hooks/useSessionProgress.js
mylocalforceW/src/hooks/useDocumentSettings.js

mylocalforceW/src/components/providerUpload/desktop/MobileUploadCard.jsx
mylocalforceW/src/components/providerUpload/desktop/SendSmsButton.jsx
mylocalforceW/src/components/providerUpload/desktop/QrCodeDisplay.jsx
mylocalforceW/src/components/providerUpload/desktop/UploadProgressTracker.jsx
mylocalforceW/src/components/providerUpload/desktop/SessionExpiryCountdown.jsx
mylocalforceW/src/components/providerUpload/desktop/DesktopFallbackUpload.jsx

mylocalforceW/src/components/providerUpload/mobile/MobileUploadPage.jsx
mylocalforceW/src/components/providerUpload/mobile/TokenValidationScreen.jsx
mylocalforceW/src/components/providerUpload/mobile/GuidedUploadFlow.jsx
mylocalforceW/src/components/providerUpload/mobile/UploadStep.jsx
mylocalforceW/src/components/providerUpload/mobile/FileCapture.jsx
mylocalforceW/src/components/providerUpload/mobile/FilePreview.jsx
mylocalforceW/src/components/providerUpload/mobile/SubmitScreen.jsx

mylocalforceW/src/components/providerUpload/shared/StatusBadge.jsx
mylocalforceW/src/components/providerUpload/shared/ExpiryBadge.jsx
mylocalforceW/src/components/providerUpload/shared/UploadErrorBoundary.jsx

mylocalforceW/src/utils/fileValidation.js
mylocalforceW/src/utils/uploadTokenUtils.js
mylocalforceW/src/utils/uploadFormatters.js
```

Modify:

```txt
mylocalforceW/package.json
mylocalforceW/src/App.jsx
mylocalforceW/src/services/firebase/index.js
mylocalforceW/src/screens/ProviderOnboardingScreen.jsx
mylocalforceW/src/services/firebase/providerOnboardingService.js
```

Non-obvious decision: use `src/services/firebase/` because all Firebase-backed web services already live there. Do not put new Firebase services directly under `src/services/`.

### 6.2 Firebase Config

`mylocalforceW/src/services/firebase/firebaseConfig.js` already exports:

```js
export const auth = getAuth(app);
export const firestore = getFirestore(app, "mylocalforce");
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");
```

Use these exports everywhere.

For mobile custom-token sign-in, import:

```js
import {
  inMemoryPersistence,
  setPersistence,
  signInWithCustomToken
} from "firebase/auth";
```

Set in-memory persistence only inside the mobile upload page before signing in with the provider custom token.

### 6.3 Service Layer

#### `uploadSessionService.js`

Export JSDoc-documented functions:

```txt
createUploadSession(payload)
sendUploadSessionSms(payload)
validateMobileUploadToken(token)
getUploadSessionStatus(payload)
submitMobileDocuments(payload)
```

All writes go through callables. No direct Firestore writes.

Use:

```js
const callable = httpsCallable(functions, "createUploadSession");
```

Normalize Firebase callable responses by returning `response.data || {}`.

#### `providerDocumentService.js`

Export:

```txt
recordDocumentUpload(payload)
subscribeProviderDocumentsBySession(sessionId, onNext, onError)
subscribeUploadSession(sessionId, onNext, onError)
```

Only subscriptions use direct Firestore reads. Writes use callables.

#### `secureDocumentStorageService.js`

This replaces the generic requested `storageService.js` name to avoid colliding with the existing `src/services/firebase/storageService.js`.

Export:

```txt
uploadProviderDocumentSecure(options)
```

Implementation:

1. Validate file using `validateFile(file, requirement)`.
2. Generate `safeFilename = uuidv4() + extension`.
3. Build storage path:

```txt
provider-documents/{providerId}/{sessionId}/{documentType}/{side}/{safeFilename}
```

4. Use `uploadBytesResumable`.
5. On completion, call `recordDocumentUpload`.
6. Return:

```js
{
  documentId,
  storagePath,
  safeFilename,
  mimeType,
  sizeBytes
}
```

Do not call `getDownloadURL`.

#### `documentSettingsService.js`

Export:

```txt
getDocumentUploadSettings()
subscribeDocumentUploadSettings(onNext, onError)
```

The website can read `documentUploadSettings/global` directly because rules allow authenticated users to read settings. Admin writes go through callables only.

### 6.4 Hooks

#### `useUploadSession`

Signature:

```js
/**
 * @param {{
 *   providerId: string,
 *   registrationStep: string,
 *   verifiedMobileNumber?: string
 * }} options
 * @returns {{
 *   session: import("../types/uploadSession").UploadSession | null,
 *   rawToken: string | null,
 *   isCreating: boolean,
 *   isSendingSms: boolean,
 *   smsCooldownRemaining: number,
 *   error: string | null,
 *   createSession: (deliveryMethod: 'sms'|'qr'|'both') => Promise<void>,
 *   sendSms: () => Promise<void>,
 *   reset: () => void
 * }}
 */
```

Rules:

- `rawToken` only in `useState`.
- Never use localStorage/sessionStorage/cookies.
- Derive cooldown using `setInterval`.
- Clear interval on unmount.
- `sendSms` updates raw token because resending rotates the token.

#### `useSessionProgress`

Attach two Firestore listeners:

1. `providerDocuments` where `uploadSessionId == sessionId`
2. `providerUploadSessions/{sessionId}`

Return cleanup that unsubscribes both.

#### `useDocumentUpload`

Input includes `requirement` because validation needs Firestore-driven rules:

```js
/**
 * @param {{
 *   sessionId: string,
 *   providerId: string,
 *   documentType: string,
 *   side: string,
 *   requirement: import("../types/uploadSession").DocumentRequirement
 * }} options
 */
```

Expose:

```txt
uploadProgress
isUploading
isComplete
error
upload(file)
retry()
```

### 6.5 Utilities

#### `fileValidation.js`

Checks in order:

1. file size
2. MIME type
3. lowercase file extension

Return:

```js
{ valid: true, error: null }
```

or:

```js
{ valid: false, error: "File type not allowed" }
```

#### `uploadTokenUtils.js`

Only URL construction and parsing:

```txt
buildMobileUploadUrl(rawToken)
extractUploadTokenFromParams(params)
```

No crypto.

#### `uploadFormatters.js`

Include:

```txt
maskE164Phone(phone)
formatBytes(bytes)
formatCountdown(milliseconds)
toDate(value)
```

Phone masking:

```txt
+44 *** *** 1234
```

For Australian and Indian numbers, keep the country code prefix and last four digits.

### 6.6 Desktop Components

#### `MobileUploadCard.jsx`

Props:

```js
/**
 * @param {{
 *   providerId: string,
 *   registrationStep: string,
 *   verifiedMobileNumber?: string
 * }} props
 */
```

State machine:

```txt
idle -> sms_sending -> sms_sent -> expired
idle -> qr_showing -> expired
```

Behavior:

- Load settings with `useDocumentSettings`.
- Hide entirely if SMS and QR are both disabled.
- Create session only on first user action.
- SMS and QR share one session.
- If QR tab is opened first, create `deliveryMethod: "qr"` or `"both"` when SMS is enabled.
- If SMS is sent first, create `deliveryMethod: "sms"` or `"both"` when QR is enabled.
- Render `SessionExpiryCountdown` only when active session exists.
- Render `UploadProgressTracker` once a session exists.
- If settings later disables SMS, hide resend button but keep progress tracking.

Integration point:

In `ProviderOnboardingScreen.jsx`, render above the secure document upload area inside `renderDocumentsStep()`:

```jsx
<MobileUploadCard
  providerId={user.uid}
  registrationStep="provider_onboarding_documents"
  verifiedMobileNumber={user.phone || user.phoneNumber}
/>
```

ASSUMPTION: The verified phone number is available on the auth profile loaded by `useAuth()` or top-level `users/{uid}` profile. If not, pass the phone from `fetchUserProfile(user.uid)`.

Before the card can create a session, `ProviderOnboardingScreen.jsx` must persist a draft of the profile, banking, business, passport number, and driving licence metadata by calling `saveProviderOnboardingDraft`. This prevents the mobile document session from becoming detached from unsaved desktop state if the browser reloads.

#### `QrCodeDisplay.jsx`

Use:

```jsx
import { QRCodeSVG } from "qrcode.react";
```

Render:

```jsx
<QRCodeSVG value={mobileUrl} size={220} />
```

Show refresh when session expires in under 10 minutes. Refresh calls `createSession` again and rotates the token.

#### `SessionExpiryCountdown.jsx`

Use `setInterval` every 1000ms. Clear on unmount and when expired.

#### `DesktopFallbackUpload.jsx`

This component replaces the current legacy file controls when `desktopFallbackEnabled` is true.

Behavior:

- Reuse the active upload session from `MobileUploadCard` when one exists.
- Create a secure upload session with `deliveryMethod: "qr"` or `"both"` if the provider chooses desktop upload before SMS/QR.
- Render one upload control per requirement side from `documentUploadSettings/global`.
- Use `uploadProviderDocumentSecure` for each upload.
- Pass `source: "desktop"` into `recordDocumentUpload`.
- Never call the legacy `uploadProviderDocument`.
- Never call `getDownloadURL`.

### 6.7 Mobile Upload Route

Modify `mylocalforceW/src/App.jsx`:

```jsx
import MobileUploadPage from "./components/providerUpload/mobile/MobileUploadPage";
```

Add public route before catch-all:

```jsx
<Route path="/mobile-upload/:token" element={<MobileUploadPage />} />
```

Do not protect this route with `RoleProtectedRoute`. The token validation callable handles access.

### 6.8 Mobile Components

#### `MobileUploadPage.jsx`

Responsibilities:

1. Read `token` from `useParams()`.
2. Render `TokenValidationScreen` while validating.
3. Call `validateMobileUploadToken(token)`.
4. If valid, set Firebase Auth persistence to `inMemoryPersistence`.
5. Sign in with `providerAuthToken`.
6. Render `GuidedUploadFlow`.
7. Handle invalid, expired, submitted, revoked states with explicit user-facing screens.

Do not store token or providerAuthToken in browser storage.

#### `GuidedUploadFlow.jsx`

Expand requirements into steps:

```js
requirements
  .sort((a, b) => a.order - b.order)
  .flatMap((requirement) =>
    requirement.sides.map((side) => ({ requirement, side }))
  )
```

Completion key:

```js
`${requirement.id}:${side}`
```

Required behavior:

- Show "Step X of Y".
- Back always allowed.
- Next disabled unless current required step is complete.
- Optional steps can be skipped.
- Final step renders `SubmitScreen`.
- If submit returns missing docs, scroll to the first missing step.

#### `FileCapture.jsx`

Use hidden file input.

Map capture hint:

```txt
camera -> accept image/*, capture environment
video  -> accept video/*, capture user
file   -> accept allowedMimeTypes.join(",")
any    -> accept allowedMimeTypes.join(",")
```

Do not use JS mobile detection.

#### `UploadStep.jsx`

Required render order:

1. Title and required/optional badge.
2. Requirement description.
3. FileCapture or re-capture button.
4. FilePreview.
5. Byte-level upload progress.
6. Error and retry.
7. Completion state.

#### `SubmitScreen.jsx`

Render this after all upload steps.

On successful `submitMobileDocuments`:

- Show a completion state.
- For `registrationStep === "provider_onboarding_documents"`, tell the provider to return to the desktop page to finish registration submission.
- For future `registrationStep === "provider_onboarding_reupload"`, show that the updated documents have been sent for review.

Do not navigate to the main provider app from this mobile page.

### 6.9 Existing Provider Onboarding Service Changes

Modify `mylocalforceW/src/services/firebase/providerOnboardingService.js` carefully.

Do not remove legacy `uploadProviderDocument` in the first release because old screens and old data still reference legacy URLs.

Do not use legacy `uploadProviderDocument` for the new cross-device feature. New desktop fallback uploads must use `DesktopFallbackUpload` plus `uploadProviderDocumentSecure`, so new provider documents never create public download URLs.

Add new save paths or extend `saveProviderDetails` so it can handle drafts and final submission when documents are stored in `providerDocuments` instead of URL fields.

Recommended draft addition:

```js
/**
 * Saves a non-submitted provider onboarding draft before cross-device upload starts.
 *
 * @param {string} userId
 * @param {object} providerDetails
 * @returns {Promise<void>}
 */
export const saveProviderOnboardingDraft = async (userId, providerDetails) => { ... };
```

Draft behavior:

- Merge into `users/{uid}/details/provider_onboarding`.
- Set `status: "draft"` unless the provider is in a reupload flow.
- Do not set `onboardingDocuments`.
- Do not set top-level `approvalStatus: "pending"`.
- Do not trigger provider approval submission.

Recommended final secure submit addition:

```js
/**
 * Saves provider onboarding details after secure document upload.
 *
 * @param {string} userId
 * @param {object} providerDetails
 * @param {{ sessionId: string, documentsMetadata?: Object.<string, *> }} uploadSummary
 * @returns {Promise<void>}
 */
export const saveProviderDetailsWithSecureDocuments = async (
  userId,
  providerDetails,
  uploadSummary,
) => { ... };
```

This function should:

- Preserve existing profile/banking/business/passport/driving fields.
- Require the referenced secure upload session to be `submitted`, or require all mandatory documents to already have `status in ["uploaded", "submitted"]` when the provider used desktop fallback.
- Merge:

```js
{
  documentUploadMode: "secure_v2",
  latestDocumentUploadSessionId: uploadSummary.sessionId,
  documentsMetadata: uploadSummary.documentsMetadata || {},
  updatedAt: serverTimestamp()
}
```

- Set top-level user flags:

```js
{
  onboardingDocuments: true,
  onboardingSubmittedAt: serverTimestamp(),
  approvalStatus: "pending",
  status: "pending"
}
```

`ProviderOnboardingScreen.jsx` final submit must call this secure save function when `documentUploadMode === "secure_v2"` or a secure upload session exists. It should only use the legacy `saveProviderDetails` path for legacy rollback/migration scenarios.

---

## 7. Admin Dashboard Implementation In `mylocalforcedashboard`

### 7.1 Files To Create Or Modify

Create:

```txt
mylocalforcedashboard/src/utils/documentUploadAdminService.js
mylocalforcedashboard/src/components/documentUploads/DocumentSettingsPanel.js
mylocalforcedashboard/src/components/documentUploads/ProviderDocumentReviewList.js
mylocalforcedashboard/src/components/documentUploads/DocumentReviewCard.js
```

Modify:

```txt
mylocalforcedashboard/src/pages/ClientApprovals.js
mylocalforcedashboard/src/App.js
```

Optional if a separate page is preferred:

```txt
mylocalforcedashboard/src/pages/DocumentUploads.js
```

### 7.2 Admin Callable Utility

Use `httpsCallable(functions, "...")`.

Export:

```txt
getDocumentUploadSettings()
updateDocumentUploadSettings(settings)
getProviderDocumentsForReview(filters)
reviewProviderDocument(payload)
revokeUploadSession(sessionId)
```

Do not write `documentUploadSettings`, `providerDocuments`, or `providerUploadSessions` directly from dashboard UI.

### 7.3 Integrate With `ClientApprovals.js`

Current admin approval page:

- Queries `users` where `roles.client == true`.
- Reads `users/{uid}/details/provider_onboarding`.
- Displays legacy `documents` URLs.
- Updates approval status directly.

Add a secure document section to the provider detail dialog:

```jsx
<ProviderDocumentReviewList providerId={viewDialogData.id} />
```

Behavior:

- Show new `providerDocuments` first.
- If no secure documents exist, show existing legacy URL fields as read-only legacy documents.
- For secure documents, use signed URLs returned by `getProviderDocumentsForReview`.
- Approve/reject individual docs through `reviewProviderDocument`.
- On full provider approval, ensure all required secure docs have `reviewStatus === "approved"` unless the provider still uses legacy documents.

### 7.4 Settings Panel

Add a dashboard page or a section under existing platform/settings navigation.

`DocumentSettingsPanel` must:

- Load settings through callable.
- Edit top-level toggles:
  - SMS enabled
  - QR enabled
  - desktop fallback enabled
  - expiry minutes
  - cooldown seconds
  - max resend count
- Edit requirements array:
  - label
  - description
  - required
  - order
  - sides
  - allowed MIME types
  - allowed extensions
  - max size
  - capture hint
- Save full object through `updateDocumentUploadSettings`.
- Validate client-side before calling server.

---

## 8. Edge Case Handling Matrix

| Scenario | Backend | Website UI |
|---|---|---|
| Token expired on mobile page load | `validateMobileUploadToken` throws `deadline-exceeded` | Show expired screen and "Return to desktop" link |
| Token already submitted | Return status or throw `failed-precondition` with status | Show already submitted screen and uploaded document list |
| Token revoked by admin | Throw `permission-denied` or `failed-precondition` with status | Show "session revoked, contact support" |
| Camera permission denied | Browser handles capture fallback | Show file picker and instruction text |
| Upload fails mid-transfer | No Firestore doc if `recordDocumentUpload` not called | Preserve existing uploaded docs from snapshot and show retry |
| Provider resends SMS after cooldown | Rotate token hash, extend expiry | Old token fails; new SMS works |
| Required doc missing on submit | Return `{ success:false, missing:[...] }` | List missing labels and scroll to first missing step |
| Admin disables SMS after session created | Resend rejects | Hide resend button reactively; active token remains valid |
| Rejected doc needs re-upload | `reviewProviderDocument` sets `reupload_required` | Re-open affected step only |
| Provider switches mobile number | New verified phone flow revokes active sessions | Desktop requires a new session after re-verification |
| Duplicate same doc + side | `recordDocumentUpload` updates existing doc | Last write wins, old Storage file remains |
| Desktop and mobile upload same doc | Same session/doc side update | Last write wins by `updatedAt` |

---

## 9. Compliance With Existing Provider Approval Logic

Existing backend functions enforce passport, driving licence, and VISA expiry logic through:

```txt
onProviderOnboardingWritten
onProviderApprovalStatusWritten
checkPassportExpiry
checkDrivingLicenceExpiry
checkVisaExpiry
restoreProviderLeadAccessAfterApproval
syncProviderOnboardingComplianceToTopLevel
```

Required updates:

1. When resolving whether passport/driving licence has a document URL, also query `providerDocuments` for:

```txt
providerId == userId
documentType in ["passport", "driving_licence"]
status in ["submitted", "approved"]
```

2. When a provider document is approved or rejected, mirror status to top-level user fields where relevant:

```txt
passportStatus
drivingLicenceStatus
drivingLicenseStatus
providerAccountDisabled
disabledReason
```

3. Existing legacy URL checks must remain for old providers.

4. Do not auto-reactivate providers unless approval status is approved and required compliance docs are approved/unexpired.

---

## 10. Deployment And Configuration

### 10.1 Functions Env

Set local `MyLocalForceApp/functions/.env`:

```txt
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
APP_BASE_URL=https://your-web-domain.com
```

Because existing functions use old Twilio env names, either also set:

```txt
TWILIO_SID=
TWILIO_TOKEN=
TWILIO_FROM=
```

or make the new helper support both.

Production:

```bash
firebase functions:secrets:set TWILIO_ACCOUNT_SID
firebase functions:secrets:set TWILIO_AUTH_TOKEN
firebase functions:secrets:set TWILIO_FROM_NUMBER
firebase functions:secrets:set APP_BASE_URL
```

Then wire secrets according to the Functions generation used. If staying on v1 callable without `runWith({ secrets })`, use Firebase environment configuration used by the current deployment process.

### 10.2 Deploy Order

1. Add indexes, rules, and functions code.
2. Deploy rules and indexes:

```bash
cd MyLocalForceApp
firebase deploy --only firestore:rules,firestore:indexes,storage
```

3. Deploy functions:

```bash
cd MyLocalForceApp
firebase deploy --only functions
```

4. Seed settings:

```bash
cd MyLocalForceApp/functions
node seedDocumentUploadSettings.js
```

5. Deploy website:

```bash
cd mylocalforceW
npm run build
```

6. Deploy dashboard:

```bash
cd mylocalforcedashboard
npm run build
```

---

## 11. Test Plan

### 11.1 Backend

Test these with Firebase emulator where possible:

- `createUploadSession` rejects unauthenticated.
- `createUploadSession` rejects other provider ID.
- `createUploadSession` revokes active prior session for same step.
- `createUploadSession` stores hash, not raw token.
- More than 3 sessions per hour rejects.
- `sendUploadSessionSms` rotates token hash.
- Old raw token fails after resend.
- Resend cooldown rejects.
- Resend max count rejects.
- `validateMobileUploadToken` rejects malformed token.
- `validateMobileUploadToken` rejects expired, revoked, submitted.
- `validateMobileUploadToken` returns provider custom token only for valid token.
- `recordDocumentUpload` rejects mismatched provider auth.
- `recordDocumentUpload` rejects invalid storage path.
- `recordDocumentUpload` rejects MIME, extension, size mismatch.
- Duplicate document side replaces existing doc record.
- `submitMobileDocuments` lists missing required labels.
- `submitMobileDocuments` marks session and docs submitted in one batch.
- Admin functions reject non-admin users.
- Admin signed URL expires after 1 hour.

### 11.2 Website

Test:

- Document settings hide card when SMS and QR disabled.
- QR creates session only on first QR action.
- SMS creates session only on first SMS action.
- SMS cooldown countdown clears interval on unmount.
- Session expiry countdown clears interval on unmount.
- Desktop progress updates without refresh.
- Mobile page signs in with in-memory custom token.
- Mobile upload does not call `getDownloadURL`.
- Mobile upload progress reaches 100.
- Refresh QR rotates token.
- Submitted mobile page shows completion.
- Browser reload of mobile page requires token validation again.
- No raw token appears in localStorage/sessionStorage/cookies.

### 11.3 Admin

Test:

- Admin settings can be loaded and saved.
- Non-admin cannot save settings.
- Provider documents show signed URL previews.
- Rejected document changes to `reupload_required`.
- Approved document changes review status.
- Legacy provider URLs still display for old applications.

### 11.4 Security Checks

Before release, run:

```bash
rg "getDownloadURL" mylocalforceW/src/components/providerUpload mylocalforceW/src/services/firebase/secureDocumentStorageService.js
rg "localStorage|sessionStorage|document.cookie|indexedDB" mylocalforceW/src/components/providerUpload mylocalforceW/src/hooks/useUploadSession.js
rg "tokenHash.*raw|rawToken.*setDoc|rawToken.*add|rawToken.*update" MyLocalForceApp/functions
rg "var " mylocalforceW/src MyLocalForceApp/functions mylocalforcedashboard/src
```

Expected:

- No `getDownloadURL` in new secure upload flow.
- No browser persistence for raw tokens.
- No raw token Firestore writes.
- No new `var`.

---

## 12. Phase Checklist

### Phase 1 - Backend Foundation

- [ ] Create backend helper modules in `MyLocalForceApp/functions`.
- [ ] Register callables in `index.js`.
- [ ] Add Firestore indexes.
- [ ] Add Firestore rules.
- [ ] Add Storage rules.
- [ ] Add settings seed script.
- [ ] Add `.env` exclusions to Functions `.gitignore`.
- [ ] Deploy to emulator or staging.

### Phase 2 - Website Services And Hooks

- [ ] Add JSDoc typedef files.
- [ ] Add callable service wrappers.
- [ ] Add secure storage upload service.
- [ ] Add hooks.
- [ ] Export services from `src/services/firebase/index.js`.
- [ ] Install `qrcode.react` and `uuid`.

### Phase 3 - Desktop UI

- [ ] Add desktop provider upload components.
- [ ] Integrate `MobileUploadCard` into `ProviderOnboardingScreen.jsx`.
- [ ] Replace the current document upload controls with `DesktopFallbackUpload` when `desktopFallbackEnabled` is true.
- [ ] Ensure the new desktop fallback uses `uploadProviderDocumentSecure`, not legacy public URL uploads.
- [ ] Keep legacy upload code only as a rollback/migration path until old providers are moved.

### Phase 4 - Mobile UI

- [ ] Add `/mobile-upload/:token` route.
- [ ] Add token validation states.
- [ ] Add in-memory custom-token sign-in.
- [ ] Add guided upload flow.
- [ ] Add submit handling and missing-doc recovery.

### Phase 5 - Admin UI

- [ ] Add admin document upload service.
- [ ] Add settings panel.
- [ ] Add review list/card.
- [ ] Integrate with `ClientApprovals.js`.
- [ ] Preserve legacy document display.

### Phase 6 - Compatibility And Cleanup

- [ ] Update compliance Functions to consider `providerDocuments`.
- [ ] Add migration plan for legacy `provider_documents`.
- [ ] Tighten legacy Storage rules after migration.
- [ ] Remove direct public download URL dependency from admin approval.

---

## 13. Final Acceptance Criteria

The feature is complete only when all of these are true:

- [ ] Provider can start onboarding on desktop and send SMS link.
- [ ] Provider can start onboarding on desktop and scan QR.
- [ ] Mobile upload works without manual provider login.
- [ ] Desktop sees mobile uploads in real time through `onSnapshot`.
- [ ] Required documents are driven by `documentUploadSettings/global`.
- [ ] Raw tokens are generated only in Functions.
- [ ] Raw tokens are never stored.
- [ ] Token hashes only are stored in Firestore.
- [ ] SMS resend rotates token and invalidates the previous link.
- [ ] New provider documents are not publicly readable.
- [ ] Admin document preview uses signed URLs.
- [ ] Admin settings writes go through callable role checks.
- [ ] Admin document review writes go through callable role checks.
- [ ] Existing provider onboarding and approval flows still work for legacy users.
- [ ] Existing RN app is not broken by web rollout.
- [ ] No new `var`.
- [ ] Exported functions and typedefs include JSDoc.
- [ ] Intervals and snapshots clean up on unmount.
- [ ] Storage rules, Firestore rules, indexes, and functions deploy together.
