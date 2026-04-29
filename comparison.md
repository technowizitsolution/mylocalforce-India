# MyLocalForce Website vs Mobile App - Pending Work and Timeline

## Purpose

This document compares the current website in `mylocalforce/` with the mobile app in `mylocalforceapp/`, then lists the pending work needed to bring the website into strong correspondence with the app.

The focus is not only "what screens are missing." It also covers routing, role flows, provider operations, customer flows, admin flows, service utilities, QA, and a realistic completion timeline.

## Current Reality

The website is not a blank project. It already has a solid React/Vite/Firebase foundation:

- React + Vite + Tailwind application shell.
- Public marketing pages.
- Customer routes for home, services, service detail, address, provider selection, booking, bookings, profile, and Stripe payment success.
- Provider signup, provider onboarding, secure document upload, under-review handling, and rejected-application reupload handling.
- Shared Firebase service layer for auth, users, services, bookings, onboarding, notifications, uploads, and Stripe.
- Real-time subscriptions for services, bookings, provider dashboard data, provider bookings, provider earnings, and business profile exist at service level.

The mobile app is still much deeper as a product surface:

- It has a full provider portal with dashboard, bookings, service management, earnings, wallet, settlement history, leads, documents, provider notifications, business profile, and edit screens.
- It has customer screens that are not yet routed on web, including notifications, edit profile, accepted leads, lead detail, order summary, payment screen, chat, and support.
- It has admin screens for dashboard, provider approval, booking settings, and payout management.
- It has mobile-only utilities such as native push display, PDF export, lead eligibility helpers, cart pricing helpers, performance tracing, and deep link handling.

The biggest correction from the previous comparison is important:

The web provider dashboard is not currently a real dashboard. `src/screens/ProviderHomeScreen.jsx` is a "coming soon" screen that sends providers to the mobile app. That means the largest website gap is provider portal parity.

## Completion Estimate

Assumption: one full-time frontend engineer, using the existing Firebase and Cloud Function contracts already present in the app and website.

Recommended timeline: 9 weeks.

If work starts on Thursday, April 30, 2026, a realistic target for full app-correspondence on the website is Friday, July 3, 2026.

Fast-track timeline with two experienced engineers: about 5 to 6 weeks, if backend access, Firebase rules, Stripe test accounts, and QA test data are ready from day one.

## Priority Summary

| Priority | Area | Why it matters | Estimated time |
|---|---|---:|---:|
| P0 | Audit, route map, shared shell | Prevents rework and broken role navigation | 2 days |
| P1 | Provider portal foundation | Largest visible gap; approved providers currently hit "coming soon" | 1 week |
| P1 | Provider bookings, leads, services | Core provider operations | 2 weeks |
| P1 | Provider earnings, wallet, settlements | Core money workflow and Stripe Connect UX | 1.5 weeks |
| P2 | Customer missing screens | Customer parity gaps after booking/profile | 1 week |
| P2 | Admin portal | Needed if web should correspond to app operationally | 1 week |
| P2 | Notifications, chat, support | Cross-role communication and operational UX | 1 week |
| P3 | QA, polish, deployment hardening | Makes the site production-ready | 1 week |

Total: about 8.5 to 9 weeks.

## App to Website Parity Map

### Auth and Role Flow

| Mobile app | Website today | Pending web work |
|---|---|---|
| `LoginScreen` | `LoginScreen.jsx` | Mostly present. Verify role routing after login for customer, provider, admin, and multi-role users. |
| `ForgotPasswordScreen` | `ForgotPasswordScreen.jsx` | Present. QA email and phone OTP flows. |
| `SignupRoleSelectionScreen` / role selection | `SignupSelectionScreen.jsx` | Present. Add terms links if web parity requires them. |
| `CustomerSignupScreen` | `CustomerSignupScreen.jsx` | Present. QA duplicate email/phone, role merge, and redirect. |
| `ProviderSignupScreen` | `ProviderSignupScreen.jsx` | Present. QA provider onboarding redirect. |
| `RoleSelectionScreen` | No full authenticated role switch screen | Add role switcher for users with multiple roles and deactivated-role recovery. |
| Admin auto-route | No admin route in `App.jsx` | Add `/admin` protected route and admin shell. |

Pending effort: 3 to 5 days, partly overlapping with the portal shell.

### Customer Surface

| Mobile app | Website today | Pending web work |
|---|---|---|
| `HomeScreen` | `customer/pages/Home.jsx` | Present. Minor parity QA only. |
| `ServicesScreen` | `customer/pages/Services.jsx` | Present. Add category-specific landing routes if full screen parity is required. |
| `ServiceDetailScreen` | `ServiceDetailsScreen.jsx` | Present. Verify package/price/category payload compatibility. |
| Category screens like `WomenSalonScreen`, `CleaningScreen`, etc. | Generic services screen | Optional web parity: create SEO-friendly category pages or redirect category routes into filtered `Services.jsx`. |
| `AddressScreen` | `AddressScreen.jsx` | Present. Verify Google key env handling and saved address persistence. |
| `ProviderSelectorScreen` | `ProviderSelectorScreen.jsx` | Present. QA public provider profile fallback and distance sorting. |
| `BookingScreen` | `BookingScreen.jsx` | Present and large. Needs pricing, order summary, and payment parity review. |
| `OrderSummaryScreen` | No route | Add `/customer/order-summary` before payment. |
| `PaymentScreen` / Stripe WebView | Website redirects to Stripe checkout and has `PaymentSuccess.jsx` | Add a clearer web payment page or confirm existing redirect flow is acceptable. Add cancel/failure route. |
| `BookingsScreen` | `Bookings.jsx` | Present. Add richer booking status actions, accepted lead links, chat link, and notification-triggered deep links. |
| `NotificationsScreen` | Only `NotificationBell.jsx` component | Add `/customer/notifications` notification center with list, filters, read/delete, detail modal/page. |
| `NotificationDetailModal` | Not present | Add reusable notification detail UI. |
| `EditProfileScreen` | `Profile.jsx` links to `/customer/edit-profile`, but route is missing | Add `/customer/edit-profile` and implement editing for name, phone, email, address, avatar, notification preferences. |
| `CustomerAcceptedLeadsScreen` | Not present | Add accepted leads view for customer-side lead lifecycle. |
| `LeadDetailScreen` | Not present | Add lead detail route and data fetch. |
| `ChatScreen` | Not present | Add customer chat route if chat is required on web. |
| `ContactSupportScreen` | Not present | Add support/contact route backed by `supportService` equivalent. |

Customer pending effort: 1 to 1.5 weeks for practical parity; 2 weeks if chat/support and category landing pages are fully built.

### Provider Surface

This is the highest priority because approved providers currently land on a placeholder.

| Mobile app | Website today | Pending web work |
|---|---|---|
| `ClientTabNavigator` provider tabs | No provider shell | Create web provider layout with sidebar/topbar/mobile bottom nav. |
| `ClientDashboard` | `ProviderHomeScreen.jsx` is "coming soon" | Replace with real provider dashboard. |
| `ClientBookings` | Service functions exist, no route/screen | Add provider bookings page with filters, live updates, accept, decline, complete, countdowns. |
| `ManageServices` | Service functions exist, no route/screen | Add manage services page. |
| `AddServiceScreen` | No route/screen | Add add-service page with catalog/category selection and image upload. |
| `EditServiceScreen` | No route/screen | Add edit-service page. |
| `CatalogServicesScreen` | No route/screen | Add catalog services page for adding/removing provider association. |
| `Earnings` | `subscribeToProviderEarnings` exists, no route/screen | Add earnings page with gross, commission, payout, filters, and export. |
| `ProviderWalletScreen` | Stripe service functions exist, no route/screen | Add wallet page with overview, transactions, payouts, Stripe Connect setup/status. |
| `SettlementHistoryScreen` | Stripe service functions exist, no route/screen | Add settlement history with details modal. |
| `ProviderLeadsScreen` | Lead creation exists in customer booking, no provider leads page | Add provider leads inbox with eligibility, status, filters, accept/decline. |
| `ProviderLeadDetailScreen` | No route/screen | Add provider lead detail page. |
| `BusinessProfile` | No route/screen | Add provider business profile page. |
| `EditBusinessProfile` | Provider onboarding can edit rejected applications only | Add normal edit business profile flow. |
| `EditProviderDetailsScreen` | No route/screen | Add edit provider details, documents, visa/passport/driving licence details, service area, gender preference, etc. |
| `ProviderDocumentsScreen` | Onboarding upload exists | Add post-approval documents page with statuses and reupload behavior. |
| `ProviderNotificationsScreen` | Notification service exists, no screen | Add provider notification center. |
| `ProfileUnderReviewScreen` | `ProviderUnderReviewScreen.jsx` | Present and stronger than older draft. QA against app. |

Provider pending effort: 4 to 5 weeks.

### Admin Surface

The mobile app has admin screens, but the website currently has no admin portal routes.

| Mobile app | Website today | Pending web work |
|---|---|---|
| `AdminDashboard` | Not present | Add `/admin` dashboard with platform stats and recent activity. |
| `ClientApprovalScreen` | User service functions exist | Add provider approval/rejection queue, document review, rejection reasons, missing details, reupload requests. |
| `BookingSettings` | Not present | Add booking settings page for acceptance window and any platform booking controls. |
| `AdminPayoutDashboard` | Stripe service has `getAllTransactions` and `getAllPayouts` | Add transaction/payout dashboard with filters, search, totals. |
| Mobile admin actions for user/service/payment/analytics | Some are placeholders in app navigation | Decide which are real scope. Add only if product needs them now. |

Admin pending effort: 1 to 1.5 weeks for the screens that already have service support.

### Cross-role Features

| Feature | Website today | Pending work |
|---|---|---|
| Notifications | Firestore service and customer bell exist | Add full notification centers for customer and provider; add detail view; support read/delete; add role filters. |
| Push notifications | Web has browser permission helpers, mobile has native FCM | Decide whether web needs browser push. At minimum, web should show Firestore notification inbox. |
| Chat | Mobile has `services/chat/chatService.js` and `ChatScreen.js` | Add web chat routes and UI or explicitly mark chat as mobile-only. |
| Support | Mobile has `supportService.js` and `ContactSupportScreen` | Add web support page/form with Firestore support tickets. |
| PDF/export | Mobile has `pdfExport.js` | Add web CSV/PDF export for earnings and settlements if provider accounting parity is required. |
| Coupons | Mobile has `couponService.js` | Add coupon/promo support to web booking/order summary if app supports it in production. |
| Pricing helpers | Mobile has `cartPricing.js`, `previewPaymentAmount` in Stripe service | Align web booking totals with mobile pricing to avoid customer payment differences. |
| Lead eligibility | Mobile has `leadEligibility.js` | Port eligibility logic into web provider lead views so providers see the same accept/block rules. |

Cross-role pending effort: 1 to 2 weeks depending on chat, support, and export depth.

## Detailed Pending Work

### 1. Route and Shell Foundation

Pending tasks:

- Add a real provider route tree under `/provider`.
- Add provider child routes:
  - `/provider/home`
  - `/provider/bookings`
  - `/provider/services`
  - `/provider/services/add`
  - `/provider/services/catalog`
  - `/provider/services/:serviceId/edit`
  - `/provider/earnings`
  - `/provider/wallet`
  - `/provider/settlements`
  - `/provider/leads`
  - `/provider/leads/:leadId`
  - `/provider/profile`
  - `/provider/profile/edit`
  - `/provider/documents`
  - `/provider/notifications`
  - `/provider/support`
- Add missing customer routes:
  - `/customer/edit-profile`
  - `/customer/notifications`
  - `/customer/order-summary`
  - `/customer/payment`
  - `/customer/payment-cancelled`
  - `/customer/accepted-leads`
  - `/customer/leads/:leadId`
  - `/customer/chat/:bookingId`
  - `/customer/support`
- Add admin routes:
  - `/admin`
  - `/admin/provider-approvals`
  - `/admin/booking-settings`
  - `/admin/payouts`
- Add protected route handling for `admin`.
- Add a web role-selection route for multi-role users.
- Add navigation visibility rules per role.
- Fix existing links that point to missing routes, especially `/customer/edit-profile`.

Estimated time: 3 to 5 days.

### 2. Provider Portal Shell

Pending tasks:

- Replace the provider "coming soon" screen with a real authenticated provider layout.
- Build a desktop sidebar and compact mobile navigation.
- Include provider status, unread notifications, quick actions, and role switch access.
- Keep onboarding and under-review routes outside the approved provider shell.
- Add shared provider page components:
  - stat cards
  - filter tabs
  - empty state
  - loading state
  - error state
  - confirmation dialog
  - detail drawer/modal
  - currency/date/status formatting helpers

Estimated time: 4 to 5 days.

### 3. Provider Dashboard

Pending tasks:

- Port the meaningful pieces of mobile `ClientDashboard` into a web dashboard.
- Use `subscribeToProviderDashboard(providerId, callback)` from `serviceService.js`.
- Show:
  - today's bookings
  - upcoming bookings
  - pending leads
  - active services
  - completed jobs
  - monthly earnings
  - unread notifications
  - urgent actions such as expiring acceptance windows
- Add dashboard cards that navigate to bookings, leads, services, earnings, wallet, and documents.
- Show account warnings:
  - pending approval
  - rejected document
  - visa or identity issue
  - missing payout setup
  - deactivated role
- Add responsive layout for mobile web.

Estimated time: 4 to 6 days.

### 4. Provider Bookings

Pending tasks:

- Build `/provider/bookings`.
- Use `subscribeToProviderBookings(providerId, callback)` for live booking updates.
- Add fallback one-time fetch using `fetchProviderBookings(providerId)`.
- Add filters:
  - all
  - pending
  - accepted
  - in progress
  - completed
  - cancelled
- Add booking detail modal/drawer.
- Add actions:
  - accept booking
  - decline booking
  - complete job
  - open chat if chat is in scope
- Preserve mobile acceptance-window behavior, including countdowns.
- Add confirmation before status-changing actions.
- Verify status values match mobile and backend:
  - pending
  - accepted
  - completed
  - cancelled
  - declined
  - any lead-specific statuses

Estimated time: 5 to 6 days.

### 5. Provider Leads

Pending tasks:

- Build `/provider/leads`.
- Build `/provider/leads/:leadId`.
- Read from the same Firestore lead data created by web booking and mobile booking flows.
- Port or reimplement `leadEligibility.js` for web.
- Add filters:
  - new
  - accepted
  - declined
  - expired
  - unavailable
- Add lead detail:
  - service
  - customer area/address visibility rules
  - proposed time
  - price
  - provider eligibility status
  - acceptance window
  - other providers/competition state if available
- Add accept/decline actions.
- Add empty states and expired lead handling.
- Add notification deep links from provider notifications to lead detail.

Estimated time: 5 to 6 days.

### 6. Provider Service Management

Pending tasks:

- Build `/provider/services` mirroring mobile `ManageServices`.
- Build `/provider/services/add`.
- Build `/provider/services/catalog`.
- Build `/provider/services/:serviceId/edit`.
- Use existing web service functions:
  - `fetchServicesByProvider`
  - `subscribeToProviderServices`
  - `fetchAllServices`
  - `fetchCategories`
  - image upload services
- Add support for:
  - active/inactive services
  - service title
  - category/subcategory
  - price
  - duration
  - description
  - image upload
  - service availability
  - provider add/remove from catalog service
- Match mobile visa/blocked-account checks before allowing service changes.
- Add optimistic UI only after core flow is stable.

Estimated time: 6 to 8 days.

### 7. Provider Earnings

Pending tasks:

- Build `/provider/earnings`.
- Use `subscribeToProviderEarnings(providerId, callback)`.
- Show:
  - total earnings
  - this month
  - pending amount
  - paid amount
  - completed jobs
  - average job value
  - platform commission
  - Stripe/gateway fee where available
  - provider payout after fees
- Add filters:
  - date range
  - status
  - booking/service
- Add transaction detail drawer.
- Add export:
  - CSV first
  - PDF later if required
- Make calculations consistent with mobile and `stripeService.js`.

Estimated time: 4 to 5 days.

### 8. Provider Wallet and Stripe Connect

Pending tasks:

- Build `/provider/wallet`.
- Use existing Stripe service functions:
  - `getProviderWalletSummary`
  - `getProviderTransactions`
  - `getProviderPayouts`
  - `getEnhancedWalletSummary`
- Add Stripe Connect setup/status checks equivalent to mobile:
  - account exists
  - onboarding complete
  - account active
  - needs setup
- Add setup payout account action using Cloud Function endpoint.
- Add tabs:
  - overview
  - transactions
  - payouts
- Add wallet summary:
  - available balance
  - pending balance
  - paid out
  - lifetime total
- Add transaction fee breakdown:
  - gross amount
  - gateway fee
  - platform commission
  - provider payout

Estimated time: 4 to 5 days.

### 9. Settlement History

Pending tasks:

- Build `/provider/settlements`.
- Query provider earnings/settlements with ordering by date.
- Add detail modal with settlement breakdown.
- Add filters by status and date.
- Add export if needed for provider accounting.
- Link wallet transaction rows to settlement details.

Estimated time: 2 to 3 days.

### 10. Provider Business Profile, Documents, and Details

Pending tasks:

- Build `/provider/profile`.
- Build `/provider/profile/edit`.
- Build `/provider/documents`.
- Build provider document status display:
  - uploaded
  - submitted
  - pending review
  - approved
  - rejected
  - reupload required
- Reuse secure document upload components where possible.
- Add edit flow for:
  - business profile
  - services offered
  - bank details
  - ABN/TFN
  - nationality/visa details
  - identity document metadata
  - notification preferences
  - service area/address
- Add account actions:
  - switch role
  - deactivate provider role
  - delete account
  - logout
- Add support link.

Estimated time: 5 to 7 days.

### 11. Provider Notifications

Pending tasks:

- Build `/provider/notifications`.
- Read notifications by provider user ID and role/type.
- Add:
  - unread count
  - read/unread toggle
  - delete notification
  - notification detail
  - link to booking/lead/settlement where applicable
- Decide browser push scope:
  - Minimum: Firestore inbox only.
  - Better: web push registration if production requires desktop/browser alerts.

Estimated time: 2 to 3 days.

### 12. Customer Notification Center

Pending tasks:

- Build `/customer/notifications`.
- Add notification list, detail modal, read/delete actions.
- Connect `NotificationBell.jsx` click to the notification center.
- Add deep links:
  - booking accepted -> booking detail
  - booking completed -> booking detail
  - booking cancelled -> booking detail
  - payment state -> payment/order page
  - lead accepted -> lead detail
- Preserve mobile notification copy and status semantics.

Estimated time: 2 to 3 days.

### 13. Customer Profile Edit

Pending tasks:

- Build `/customer/edit-profile` because `Profile.jsx` already links there.
- Add editable fields:
  - display name
  - email where allowed
  - phone where allowed
  - address
  - avatar/profile image
  - notification preferences
- Reuse `profileImageUpload.js`.
- Reuse `fetchUserProfile` and profile update functions.
- Add validation and duplicate phone/email handling.
- Return to `/customer/profile` on save.

Estimated time: 2 to 3 days.

### 14. Customer Order Summary and Payment

Pending tasks:

- Add `/customer/order-summary`.
- Add `/customer/payment` only if the product wants a web payment review screen before Stripe.
- Port relevant pricing logic from mobile:
  - `cartPricing.js`
  - `previewPaymentAmount`
  - coupon support if enabled
  - service/package total
  - fees and discounts
- Add Stripe cancel/failure route.
- Confirm payment success route updates booking status exactly once.
- Show order number if backend/mobile expects it.
- Verify booking created by web has fields mobile provider screens need.

Estimated time: 4 to 5 days.

### 15. Customer Accepted Leads and Lead Detail

Pending tasks:

- Build `/customer/accepted-leads`.
- Build `/customer/leads/:leadId`.
- Show providers who accepted/responded to the customer lead, if that is the production lead model.
- Link from booking and notification flows.
- Add status labels and empty states.
- Confirm privacy rules for provider/customer details.

Estimated time: 3 to 4 days.

### 16. Chat and Support

Pending tasks:

- Decide whether chat is required for web launch parity.
- If yes, port `chatService.js` into web services.
- Build `/customer/chat/:bookingId` and `/provider/chat/:bookingId`.
- Add message list, composer, read state, and realtime listener.
- Add `/customer/support` and `/provider/support`.
- Port or recreate `supportService.js`.
- Add support ticket submission and history if app behavior requires it.

Estimated time:

- Support only: 2 to 3 days.
- Chat plus support: 5 to 7 days.

### 17. Admin Portal

Pending tasks:

- Build `/admin` shell and route protection for admin users.
- Build dashboard:
  - total users
  - total providers
  - total customers
  - pending applications
  - total bookings
  - recent activity
- Build provider approval queue:
  - list pending applications
  - view provider details
  - view documents safely
  - approve
  - reject
  - require reupload
  - add admin notes/reasons
- Build booking settings:
  - acceptance window minutes
  - saved in `settings/booking`
- Build payout dashboard:
  - transactions
  - payouts
  - totals
  - status filters
  - search
- Add audit-friendly confirmations for admin actions.

Estimated time: 6 to 8 days.

### 18. Service Layer Alignment

Pending tasks:

- Compare and align the following mobile-only files:
  - `src/services/firebase/supportService.js`
  - `src/services/firebase/couponService.js`
  - `src/services/firebase/pushDisplayService.js`
  - `src/services/chat/chatService.js`
  - `src/utils/cartPricing.js`
  - `src/utils/leadEligibility.js`
  - `src/utils/pdfExport.js`
  - `src/utils/perfTrace.js`
  - `src/hooks/useDeepLinking.js`
- Decide web equivalent for each:
  - port
  - replace with browser-native flow
  - mark mobile-only
- Add missing Stripe `previewPaymentAmount` to web if order summary needs exact parity.
- Keep collection names, field names, statuses, and timestamps identical across web and app.
- Avoid duplicating business rules inside UI components where a shared utility is better.

Estimated time: 3 to 5 days, overlapped with feature work.

## Recommended Timeline

### Phase 0 - Audit and Architecture Lock

Dates: Thursday, April 30, 2026 to Friday, May 1, 2026

Deliverables:

- Final route map.
- Confirm which mobile-only features are required on web.
- Confirm Firebase collections and Cloud Function endpoints.
- Confirm admin role access.
- Confirm Stripe test account and Connect onboarding test flow.
- Create shared provider/customer/admin layout plan.

Exit criteria:

- No unclear screen ownership.
- No unclear role route.
- No unclear backend contract for provider bookings, leads, earnings, wallet, admin approval, and notifications.

### Phase 1 - Web App Shell and Provider Portal Foundation

Dates: Monday, May 4, 2026 to Friday, May 8, 2026

Deliverables:

- Provider shell.
- Provider route tree.
- Role selection route.
- Admin route guard stub.
- Replace provider "coming soon" with real shell landing.
- Shared provider layout components.
- Navigation wired for dashboard, bookings, services, earnings, wallet, leads, profile, documents, notifications.

Exit criteria:

- Approved provider can log in on web and see a real provider dashboard shell.
- Pending/rejected provider still goes to onboarding/under-review.
- Customer routes still work.

### Phase 2 - Provider Operations Part 1

Dates: Monday, May 11, 2026 to Friday, May 22, 2026

Deliverables:

- Provider dashboard.
- Provider bookings.
- Provider leads.
- Provider lead detail.
- Booking status actions.
- Lead accept/decline actions.
- Notification links into booking/lead detail.

Exit criteria:

- Provider can manage real incoming work from the website.
- Booking and lead status changes match mobile behavior.
- No provider is forced to use the mobile app for core daily operations.

### Phase 3 - Provider Operations Part 2

Dates: Monday, May 25, 2026 to Friday, June 5, 2026

Deliverables:

- Manage services.
- Add service.
- Edit service.
- Catalog services.
- Earnings page.
- Wallet page.
- Settlement history.
- Stripe Connect setup/status.
- CSV export for earnings or settlements.

Exit criteria:

- Provider can manage services and money workflows on web.
- Stripe and payout data is visible and consistent with app.
- Service data created/edited on web appears correctly in the mobile app.

### Phase 4 - Customer Parity

Dates: Monday, June 8, 2026 to Friday, June 12, 2026

Deliverables:

- Customer edit profile.
- Customer notifications center.
- Notification detail UI.
- Order summary.
- Payment/cancel flow polish.
- Customer accepted leads.
- Customer lead detail.
- Optional category landing routes.

Exit criteria:

- Existing customer profile links no longer point to missing routes.
- Customer can understand booking/payment/lead state without needing the mobile app.
- Web-created bookings remain app-compatible.

### Phase 5 - Admin Portal

Dates: Monday, June 15, 2026 to Friday, June 19, 2026

Deliverables:

- Admin shell.
- Admin dashboard.
- Provider approval/rejection queue.
- Document review actions.
- Booking settings.
- Payout dashboard.

Exit criteria:

- Admin can approve/reject providers from the website.
- Admin can manage booking settings from the website.
- Admin can inspect payments/payouts from the website.

### Phase 6 - Chat, Support, Notifications, and Utility Alignment

Dates: Monday, June 22, 2026 to Friday, June 26, 2026

Deliverables:

- Provider notification center.
- Cross-role notification routing.
- Support pages.
- Chat, if required for web parity.
- Port support/coupon/pricing/lead eligibility helpers as needed.
- Browser push decision implemented or documented as mobile-only.

Exit criteria:

- Cross-role communication and support flows are no longer mobile-only unless intentionally scoped that way.
- Pricing and lead rules match mobile.

### Phase 7 - QA, Polish, and Deployment Hardening

Dates: Monday, June 29, 2026 to Friday, July 3, 2026

Deliverables:

- Full regression pass.
- Responsive QA for desktop, tablet, and mobile web.
- Firebase rules/index validation.
- Stripe test payment and Connect test flow.
- Provider onboarding plus approval plus first job end-to-end.
- Customer booking plus provider accept plus completion plus settlement end-to-end.
- Admin approval/rejection end-to-end.
- Production deployment checklist.

Exit criteria:

- App-correspondence is functionally complete.
- No broken route from navigation.
- No known critical role-routing issue.
- No payment/booking/provider status mismatch between web and mobile.

## Testing Checklist

### Customer End-to-End

- Customer signup.
- Customer login with email.
- Customer login with phone OTP.
- Browse services.
- Select category.
- View service detail.
- Enter/select address.
- Select provider.
- Create booking.
- Pay through Stripe.
- Return to payment success.
- View booking.
- Receive notification.
- Edit profile.
- View accepted leads or lead detail if enabled.
- Contact support.

### Provider End-to-End

- Provider signup.
- Complete onboarding.
- Upload documents.
- Admin approves provider.
- Provider lands on real web dashboard.
- Provider receives booking/lead.
- Provider accepts booking/lead.
- Provider completes booking.
- Provider sees earnings.
- Provider sees wallet.
- Provider sees settlement history.
- Provider edits services.
- Provider edits business profile.
- Provider views documents.
- Provider receives notifications.

### Admin End-to-End

- Admin login.
- Admin dashboard loads stats.
- Admin views pending providers.
- Admin approves provider.
- Admin rejects provider with reason.
- Provider sees rejection and reuploads.
- Admin updates booking settings.
- Admin views payouts/transactions.

### Data Compatibility

- Booking created on web appears correctly in mobile app.
- Booking created on mobile appears correctly on web.
- Provider service edited on web appears correctly in mobile.
- Provider service edited on mobile appears correctly on web.
- Notification created by backend appears in both app and website.
- Payment state is identical in both app and website.
- Lead status is identical in both app and website.

## Risks and Dependencies

### High-risk items

- Provider portal is the biggest missing area and has the most business logic.
- Payment and settlement screens must match backend calculations exactly.
- Lead eligibility logic must be shared or ported carefully.
- Admin document review needs Firebase Storage and Firestore rule confidence.
- Chat can expand scope quickly if read receipts, attachments, or moderation are required.

### Backend dependencies

- Cloud Functions for Stripe checkout, Connect onboarding, Connect status, lead broadcast, OTP, and provider public profile.
- Firebase indexes for booking, earnings, leads, notifications, and admin queries.
- Firebase Storage access for provider documents and service/profile images.
- Firestore security rules for admin/provider/customer data separation.

### Product decisions needed

- Should browser push notifications be required, or is in-app notification center enough for web?
- Should web include chat at launch, or support form only?
- Should all mobile category screens become separate web pages, or should web use filtered service routes?
- Should admin user/service/payment/analytics pages from mobile placeholders be in this version?
- Should earnings export be CSV only first, or CSV plus PDF?

## Recommended MVP Cut

If the goal is to launch useful web parity quickly, do this first:

1. Provider shell and dashboard.
2. Provider bookings with accept/decline/complete.
3. Provider leads and lead detail.
4. Provider services management.
5. Provider earnings/wallet/settlements.
6. Customer edit profile and notifications.
7. Admin provider approval.
8. QA end-to-end.

This MVP can be completed in about 5 to 6 weeks by one engineer, but it intentionally delays chat, full support history, category landing pages, PDF exports, and deeper admin analytics.

## Final Assessment

The website already has a good backend foundation and strong customer booking work. The missing work is mainly product-surface parity.

The highest impact work is to convert the provider side from "coming soon" into a real provider portal. After that, fill the customer route gaps, add the admin portal, and align cross-role utilities like notifications, pricing, leads, support, and chat.

With a focused single-engineer plan, the whole website can reach strong correspondence with the app in about 9 weeks, targeting Friday, July 3, 2026 if started Thursday, April 30, 2026.
