/**
 * Google Maps utilities — shared across the app.
 *
 * Uses the Google Maps JavaScript SDK (loaded on-demand) for:
 *  • Place Autocomplete  (browser CORS-safe via JS SDK)
 *  • Geocoding            (browser CORS-safe via JS SDK)
 *
 * The REST endpoints (`/maps/api/place/autocomplete/json` and
 * `/maps/api/geocode/json`) do NOT support browser-origin CORS requests,
 * so we must use the SDK instead.
 */

export const GOOGLE_MAPS_API_KEY = 'AIzaSyBfeBvLPaPSEyHpwuqcUXCa-YJnZ3iJu1Q';

/* ------------------------------------------------------------------ */
/*  Script loader                                                      */
/* ------------------------------------------------------------------ */

let _loadPromise = null;

/**
 * Load the Google Maps JavaScript SDK (once).
 * Returns a resolved promise when `window.google.maps` is available.
 */
export function loadGoogleMapsSDK() {
  if (_loadPromise) return _loadPromise;

  if (window.google?.maps) {
    _loadPromise = Promise.resolve(window.google.maps);
    return _loadPromise;
  }

  _loadPromise = new Promise((resolve, reject) => {
    // Create a unique callback name
    const cbName = '__gmapsReady_' + Date.now();
    window[cbName] = () => {
      delete window[cbName];
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps SDK failed to initialise'));
      }
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=${cbName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      delete window[cbName];
      _loadPromise = null;
      reject(new Error('Failed to load Google Maps SDK script'));
    };
    document.head.appendChild(script);
  });

  return _loadPromise;
}

/* ------------------------------------------------------------------ */
/*  Autocomplete                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch place autocomplete predictions for `input`.
 * Uses the JS SDK AutocompleteService (CORS-safe).
 *
 * @param {string} input  – partial user text
 * @returns {Promise<Array<{description:string, place_id:string}>>}
 */
export async function fetchAutocompleteSuggestions(input) {
  if (!input || input.length < 3) return [];

  try {
    const maps = await loadGoogleMapsSDK();
    const service = new maps.places.AutocompleteService();

    return new Promise((resolve) => {
      service.getPlacePredictions({ input }, (predictions, status) => {
        if (status === maps.places.PlacesServiceStatus.OK && predictions) {
          resolve(
            predictions.slice(0, 6).map((p) => ({
              description: p.description,
              place_id: p.place_id,
            })),
          );
        } else {
          resolve([]);
        }
      });
    });
  } catch (err) {
    console.warn('Autocomplete SDK error:', err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Geocoding                                                          */
/* ------------------------------------------------------------------ */

/**
 * Geocode an address string → { formattedAddress, lat, lng, raw }.
 * Uses the JS SDK Geocoder (CORS-safe).
 *
 * @param {string} address
 * @returns {Promise<{formattedAddress:string, lat:number, lng:number, raw:object}|null>}
 */
export async function geocodeAddress(address) {
  if (!address) return null;

  try {
    const maps = await loadGoogleMapsSDK();
    const geocoder = new maps.Geocoder();

    return new Promise((resolve) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const result = results[0];
          const loc = result.geometry.location;
          resolve({
            formattedAddress: result.formatted_address,
            lat: loc.lat(),
            lng: loc.lng(),
            raw: result,
          });
        } else {
          resolve(null);
        }
      });
    });
  } catch (err) {
    console.warn('Geocode SDK error:', err);
    return null;
  }
}
