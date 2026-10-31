# Tennyson / Sky

Personal aircraft-view dashboard from -34.887504, 138.484094 using your cinematic blue-hour photo.

## Run it

Install Node.js 20 or newer, then in this folder:

```bash
node server.mjs
```

Open http://localhost:3000 in your browser. Internet access is required for aircraft data.

The backend fetches actual ADS-B positions from Airplanes.live (with ADSB One fallback) every 15 seconds and forwards normalized position data to the dashboard. It never fabricates aircraft if feeds fail. You may need provider API approval or changes to the server depending on their current access and usage policies. Don't expose the server publicly without adding basic caching and access controls.

## Calibration needed

The camera defaults to 114° bearing, 78° horizontal FOV and 21° pitch. These are estimates, **not** measurements of the photograph. Open **Calibrate view** and fine tune against aircraft observed in your sky. Compass heading comes from the ADS-B source; screen direction and visibility projection depend on calibration.

The 'Likely arrivals' filter is approximate and uses aircraft altitude, descent rate and distance to Adelaide airport. ADS-B point feeds do not reliably provide destination, aircraft origin, schedule or ETA. Photo is artistically edited and not synchronized with live weather or light.

The dashboard currently leaves the weather card disconnected rather than presenting fake live weather; connect a weather API in a future version.
