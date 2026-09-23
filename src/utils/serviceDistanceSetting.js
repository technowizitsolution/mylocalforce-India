import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase/firebaseConfig';

// Per-service distance limit, set by the admin on the dashboard Services page and stored on
// services/{id} as `distanceLogicEnabled` (boolean) and `distanceLimitKm` (number).
// Services saved before the setting existed have neither field: treat them as ON at the
// default radius so behavior is unchanged until an admin edits them.
export const DEFAULT_SERVICE_DISTANCE_KM = 20;

const LOG_PREFIX = '[ServiceDistanceLogic]';

export const resolveServiceDistanceSetting = (service) => {
  const km = Number(service?.distanceLimitKm);
  return {
    enabled: service?.distanceLogicEnabled !== false,
    limitKm: Number.isFinite(km) && km > 0 ? km : DEFAULT_SERVICE_DISTANCE_KM,
  };
};

const DEFAULT_SETTING = { enabled: true, limitKm: DEFAULT_SERVICE_DISTANCE_KM };

const fetchOne = async (serviceId, context) => {
  try {
    const snap = await getDoc(doc(firestore, 'services', serviceId));
    if (!snap.exists()) {
      console.warn(`${LOG_PREFIX} ${context}: service not found, using default`, {
        serviceId,
        applied: DEFAULT_SETTING,
      });
      return { serviceId, ...DEFAULT_SETTING, source: 'not_found' };
    }
    const data = snap.data() || {};
    return {
      serviceId,
      title: data.title || data.name || null,
      storedDistanceLogicEnabled: data.distanceLogicEnabled,
      storedDistanceLimitKm: data.distanceLimitKm,
      ...resolveServiceDistanceSetting(data),
      source: 'firestore',
    };
  } catch (error) {
    console.warn(`${LOG_PREFIX} ${context}: failed to read service, using default`, {
      serviceId,
      error: error?.message || String(error),
      applied: DEFAULT_SETTING,
    });
    return { serviceId, ...DEFAULT_SETTING, source: 'error' };
  }
};

/**
 * Reads the distance setting for one service id or several (a cart).
 * With several services the strictest wins: if any is ON, the limit applies,
 * using the smallest radius among the ON services.
 * Returns { enabled, limitKm, serviceIds }.
 */
export const fetchServiceDistanceSetting = async (serviceIds, context = 'lookup') => {
  const ids = [
    ...new Set(
      (Array.isArray(serviceIds) ? serviceIds : [serviceIds])
        .filter((id) => typeof id === 'string' && id.trim())
    ),
  ];

  if (ids.length === 0) {
    console.warn(`${LOG_PREFIX} ${context}: no serviceId available, using default`, {
      applied: `ON (${DEFAULT_SERVICE_DISTANCE_KM} km)`,
    });
    return { ...DEFAULT_SETTING, serviceIds: [] };
  }

  const perService = await Promise.all(ids.map((id) => fetchOne(id, context)));
  const enabledServices = perService.filter((s) => s.enabled);
  const combined = enabledServices.length > 0
    ? { enabled: true, limitKm: Math.min(...enabledServices.map((s) => s.limitKm)) }
    : { enabled: false, limitKm: DEFAULT_SERVICE_DISTANCE_KM };

  console.log(`${LOG_PREFIX} ${context}: setting resolved`, {
    serviceIds: ids,
    perService,
    applied: combined.enabled ? `ON (${combined.limitKm} km)` : 'OFF (no distance restriction)',
  });

  return { ...combined, serviceIds: ids };
};

export const isWithinServiceDistance = (distanceKm, setting) =>
  !setting?.enabled || (Number.isFinite(distanceKm) && distanceKm <= setting.limitKm);
