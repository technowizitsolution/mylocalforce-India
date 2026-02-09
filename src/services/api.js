const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const getAuthToken = () => localStorage.getItem('authToken');

const apiCall = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

export const api = {
  get: (endpoint) => apiCall(endpoint, { method: 'GET' }),
  post: (endpoint, body) =>
    apiCall(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  put: (endpoint, body) =>
    apiCall(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (endpoint) => apiCall(endpoint, { method: 'DELETE' }),
  patch: (endpoint, body) =>
    apiCall(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

// Services API calls
export const serviceApi = {
  getAllServices: () => api.get('/services'),
  getServiceById: (id) => api.get(`/services/${id}`),
  searchServices: (query) => api.get(`/services/search?q=${query}`),
  getCategories: () => api.get('/categories'),
  getServicesByCategory: (categoryId) => api.get(`/categories/${categoryId}/services`),
};

// Bookings API calls
export const bookingApi = {
  createBooking: (bookingData) => api.post('/bookings', bookingData),
  getUserBookings: () => api.get('/bookings'),
  getBookingById: (id) => api.get(`/bookings/${id}`),
  cancelBooking: (id) => api.patch(`/bookings/${id}/cancel`, {}),
  updateBooking: (id, data) => api.put(`/bookings/${id}`, data),
};

// User Profile API calls
export const userApi = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (userData) => api.put('/users/profile', userData),
  uploadProfileImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/users/profile/image`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: formData,
    });
    if (!response.ok) throw new Error('Image upload failed');
    return response.json();
  },
  deleteAccount: () => api.delete('/users/profile'),
};
