## API Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000/api

# App Information
VITE_APP_NAME=MyLocalForce
VITE_APP_VERSION=1.0.0

# Environment
VITE_ENVIRONMENT=development
```

### Development Server Setup

To run a mock API server locally, you can use json-server or create a simple Node.js server.

#### Option 1: Using json-server

1. Install json-server:
```bash
npm install --save-dev json-server
```

2. Create `db.json` in the root:
```json
{
  "services": [],
  "users": [],
  "bookings": []
}
```

3. Start the server:
```bash
npx json-server --watch db.json --port 3000
```

#### Option 2: Using Express.js

Create a simple `server.js`:

```javascript
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Routes here
app.get('/api/services', (req, res) => {
  res.json({ services: [] });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### API Authentication

The app uses Bearer token authentication. Tokens are stored in localStorage:

```javascript
// Token stored as
localStorage.setItem('authToken', 'token_here');

// Sent in headers as
Authorization: Bearer token_here
```

### Making API Calls

Use the centralized API service:

```javascript
import { serviceApi, bookingApi, userApi } from '@/services/api';

// Get all services
const services = await serviceApi.getAllServices();

// Create a booking
const booking = await bookingApi.createBooking({
  serviceId: 1,
  providerId: 2,
  date: '2024-02-15',
  time: '10:00 AM'
});

// Get user profile
const profile = await userApi.getProfile();
```

### Error Handling

All API errors are caught and logged:

```javascript
try {
  const data = await serviceApi.getAllServices();
} catch (error) {
  // Error is logged automatically
  // Handle in UI with ErrorMessage component
}
```

---

See API documentation for endpoint specifications.
