// Fields from a provider's user profile that a customer is allowed to see.
// Everything else (home address, coordinates, phone, email, DOB, documents,
// onboarding/bank data, etc.) is private and must not reach customer screens,
// router state or localStorage.
const PUBLIC_PROVIDER_FIELDS = [
  'uid',
  'id',
  'name',
  'fullName',
  'full_name',
  'displayName',
  'display_name',
  'firstName',
  'first_name',
  'lastName',
  'last_name',
  'businessName',
  'company',
  'photoURL',
  'photoUrl',
  'avatar',
  'photo',
  'profileImage',
  'picture',
  'profile_image',
  'imageUrl',
  'gender',
  'rating',
  'avgRating',
  'ratingAvg',
  'rating_value',
  'ratingsAvg',
  'ratingAverage',
  'rating_score',
  'reviewCount',
  'totalReviews',
  'services',
  'servicesOffered',
  'offeredServices',
  'providedServices',
  'skills',
  'bio',
  'description',
  'about',
  'experience',
];

const pickPublic = source => {
  const out = {};
  for (const key of PUBLIC_PROVIDER_FIELDS) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
};

export const toPublicProviderProfile = profile => {
  if (!profile || typeof profile !== 'object') return null;
  const result = pickPublic(profile);
  // Some profiles keep experience under a nested `profile` object.
  if (profile.profile && typeof profile.profile === 'object' && profile.profile.experience) {
    result.profile = { experience: profile.profile.experience };
  }
  return result;
};

// Sanitises a provider list item ({ id, profile, coords, distanceKm, ... })
// before it is rendered, passed through navigation or saved as a cart draft.
// Coordinates are only needed to compute distanceKm, so they are dropped.
export const toPublicProviderEntry = entry => {
  if (!entry || typeof entry !== 'object') return entry;
  const {
    coords: _coords,
    profile,
    address: _address,
    formattedAddress: _formattedAddress,
    location: _location,
    phone: _phone,
    phoneNumber: _phoneNumber,
    email: _email,
    dob: _dob,
    dateOfBirth: _dateOfBirth,
    ...rest
  } = entry;
  return { ...rest, profile: toPublicProviderProfile(profile) };
};
