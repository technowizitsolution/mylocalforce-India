Firebase service integration notes

Short usage snippets to integrate the modular services with your existing signup/login screens.

Phone OTP (native react-native-firebase flow):

1) Send SMS (from UI):

```js
import { sendPhoneVerificationNative, confirmNativeOtp } from './rnfbPhoneService';

const confirmation = await sendPhoneVerificationNative('+15555551234');
// store confirmation in state
```

2) Confirm OTP (from UI):

```js
// if you want to use the native confirmation to sign in and then create profile
const credentialResult = await confirmNativeOtp(confirmation, '123456');
// credentialResult contains user info from native RNFB; you can now call
// createOrUpdateUserProfile(credentialResult.user.uid, { phone: credentialResult.user.phoneNumber }, 'customer')
```

Image upload (React Native):

```js
import { uriToBlob } from './uploadHelpers';
import { uploadProfileImage } from './storageService';

const blob = await uriToBlob(localImageUri);
const url = await uploadProfileImage(uid, blob, 'image/jpeg');
// store url in Firestore profile if needed
```

Linking flows:

1) Link email/password to a phone-first user:

```js
// user is currentUser signed-in via phone
await linkEmailToPhoneUser(user, 'me@example.com', 'strongPassword');
```

2) Link phone to email-first user:

```js
// sign in email user then send phone verification via sendPhoneVerificationNative
const confirmation = await sendPhoneVerificationNative(phone);
// then confirm
await linkPhoneToEmailUser(user, verificationId, otp);
```

Guest redirect pattern (example):

```js
// in a protected action handler
await checkAuthAndRedirect(async () => {
  // perform protected action here (createBooking)
}, navigation, 'BookingScreen');
```

Client dashboard notes:

```js
import { fetchClientData, switchActiveRole } from './clientService';

// fetch profile + client services
const { profile, services } = await fetchClientData(uid);

// To switch active role persistently
await switchActiveRole(uid, 'client');
```

