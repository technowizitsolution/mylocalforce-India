# Deployment Guide

## Prerequisites

- Node.js 16+ installed
- npm 8+ installed
- Git repository set up
- Hosting platform account (Vercel, Netlify, GitHub Pages, etc.)

## Pre-deployment Checklist

- [ ] All tests passing
- [ ] No console errors/warnings
- [ ] Environment variables configured
- [ ] API endpoints verified
- [ ] Build completes successfully
- [ ] Code reviewed and linted
- [ ] Updated version number in package.json
- [ ] Updated CHANGELOG

## Building for Production

```bash
# Install dependencies
npm install

# Run linting
npm run lint:fix

# Format code
npm run format

# Build
npm run build

# Preview build locally
npm run preview
```

## Deployment Options

### Option 1: Vercel (Recommended for Vite)

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Deploy**
```bash
vercel
```

3. **Configure environment variables**
   - Go to project settings on Vercel dashboard
   - Add `VITE_API_BASE_URL` and other env vars

### Option 2: Netlify

1. **Build locally**
```bash
npm run build
```

2. **Connect to Netlify**
   - Connect your Git repository
   - Set build command: `npm run build`
   - Set publish directory: `dist`

3. **Configure environment variables**
   - In Netlify dashboard: Settings → Build & Deploy → Environment

### Option 3: GitHub Pages

1. **Update vite.config.js**
```javascript
export default {
  // ... other config
  base: '/your-repo-name/', // Add this line
}
```

2. **Create GitHub Actions workflow** (`.github/workflows/deploy.yml`)
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Option 4: Self-hosted (Docker)

1. **Create Dockerfile**
```dockerfile
FROM node:16-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:16-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

2. **Build and run**
```bash
docker build -t myapp .
docker run -p 3000:3000 myapp
```

## Environment Configuration

### Production Environment Variables

```bash
# .env.production
VITE_API_BASE_URL=https://api.yourdomain.com/api
VITE_APP_NAME=MyLocalForce
VITE_ENVIRONMENT=production
```

### Staging Environment Variables

```bash
# .env.staging
VITE_API_BASE_URL=https://staging-api.yourdomain.com/api
VITE_APP_NAME=MyLocalForce (Staging)
VITE_ENVIRONMENT=staging
```

## Performance Optimization

### Bundle Analysis

```bash
npm install --save-dev rollup-plugin-visualizer
```

Then update `vite.config.js`:
```javascript
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  plugins: [
    // ... other plugins
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ]
}
```

### Compression

Enable gzip compression on your server:

**Vercel**: Automatic
**Netlify**: Automatic
**Custom**: Configure on your web server (nginx, Apache, etc.)

## Security Checklist

- [ ] Content Security Policy (CSP) headers configured
- [ ] HTTPS enforced
- [ ] Sensitive data not in code
- [ ] API keys secured
- [ ] CORS properly configured
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented

### Security Headers

Add to your server configuration:

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self';
```

## Monitoring & Analytics

### Error Tracking
Consider integrating Sentry or similar:
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: import.meta.env.VITE_ENVIRONMENT,
});
```

### Analytics
Integrate Google Analytics or Mixpanel:
```javascript
// Google Analytics example
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const usePageTracking = () => {
  const location = useLocation();
  
  useEffect(() => {
    window.gtag('config', 'GA_MEASUREMENT_ID', {
      page_path: location.pathname,
    });
  }, [location]);
};
```

## Rollback Procedure

### Vercel
- Go to Deployments tab
- Click on previous deployment
- Click "Promote to Production"

### Netlify
- Go to Deploys tab
- Select previous deployment
- Click "Publish deploy"

### Manual
- Restore from git: `git revert <commit-hash>`
- Rebuild and redeploy

## Post-deployment

- [ ] Test all functionality
- [ ] Check console for errors
- [ ] Verify API connectivity
- [ ] Test on multiple browsers/devices
- [ ] Monitor error tracking
- [ ] Check analytics
- [ ] Update status page if available

## Troubleshooting

### Common Issues

**Issue**: Build fails with "VITE_* not found"
- Ensure env variables are prefixed with `VITE_`
- Restart build process

**Issue**: Routes not working after deployment
- Check the `base` property in vite.config.js
- Ensure your hosting provider supports SPA routing

**Issue**: API calls failing in production
- Verify CORS headers on your API
- Check API base URL in production env
- Check with browser DevTools Network tab

## Support

For issues or questions, please refer to:
- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com)
- [Vite Deployment Guide](https://vite.dev/guide/static-deploy.html)

---

Last Updated: February 2026
