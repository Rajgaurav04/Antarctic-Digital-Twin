# Antarctic Digital Twin — Maitri & Bharati

A working prototype for exploring and monitoring India's Antarctic research stations, with an operations dashboard and an interactive 3D twin.

**Prototype data:** station operational readings are simulated. Weather can be fetched from Open-Meteo with fallback values. AI models are trained on synthetic data. Building layouts and nearby routes are interpreted, not surveyed engineering drawings. This project is not an official NCPOR operational system.

## Features

- Maitri and Bharati operations dashboards, charts, sensor details and alerts.
- Interactive 3D models with orbit, pan, zoom, fullscreen and smooth keyboard movement in the normal view.
- Thirteen guided tour stops per station, explaining systems and opening relevant interiors.
- Animated water, fuel, electricity, heating and cargo workflows.
- Incident exercises: blizzard, water-pipe freeze, generator trip and glycol pressure loss.
- Affected equipment highlighted red, including equipment behind walls.
- Scene weather previews: mild, cold, extreme cold and blizzard; blended ground snow, snowy rock tops and roof coverage.
- WebSocket telemetry with HTTP polling fallback.
- Isolation Forest health analysis and Ridge Regression fuel forecasts.

Scene weather previews affect the 3D scene, not dashboard operational readings. Select **Follow station** to use station conditions for the scene.

## Windows setup and run

### 1. Install prerequisites

Use Windows 10/11 and a modern browser with graphics acceleration enabled.

| Software | Version | Download |
|---|---|---|
| Git | Current Windows release | [Git for Windows](https://git-scm.com/install/windows) |
| Python | 3.12 or newer, 64-bit | [Python for Windows](https://www.python.org/downloads/windows/) |
| Node.js | 24 LTS recommended; 22.12+ also supported | [Node.js](https://nodejs.org/en/download) |

For Python, enable **Add Python to PATH** if offered. Node.js includes npm. Reopen your terminal after installing prerequisites.

### 2. Clone your repository

Open **PowerShell**:

```powershell
git clone https://github.com/Rajgaurav04/Antarctic-Digital-Twin.git
cd Antarctic-Digital-Twin
```

### 3. First-time setup

```powershell
.\setup_windows.bat
```

This creates `backend\venv`, installs backend dependencies, applies database migrations, creates Maitri/Bharati sample data, and installs frontend dependencies using the lockfile. If a step fails, setup stops and shows the error. Internet access is needed for dependency downloads.

### 4. Run the project

```powershell
.\start_platform.bat
```

Two terminal windows open: **backend** and **frontend**. Keep both open while using the app.

Open:

- Dashboard: <http://127.0.0.1:5173/#/dashboard>
- 3D twin: <http://127.0.0.1:5173/#/twin>
- Backend API: <http://127.0.0.1:8000/api/stations/>

For later runs, use `start_platform.bat` again. Missing setup files trigger first-time setup automatically. Close the two server windows, or press **Ctrl+C** in each, to stop.

The launchers use the virtual environment's Python executable directly. You do not need administrator access, virtual-environment activation, PowerShell execution-policy changes, Redis, Docker, an AI API key, or government station credentials for the local prototype.

### Manual Windows setup

If you prefer individual commands, run these from the repository root:

```powershell
py -3 -m venv backend\venv
.\backend\venv\Scripts\python.exe -m pip install --upgrade pip
.\backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Push-Location backend
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py seed_stations
Pop-Location
Push-Location frontend
npm.cmd ci
Pop-Location
```

Then run the backend in one PowerShell window:

```powershell
cd backend
.\venv\Scripts\python.exe -m daphne -b 127.0.0.1 -p 8000 antarctic_ops.asgi:application
```

In a second window, from the repository root:

```powershell
cd frontend
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

If `py` is unavailable, use `python` for the virtual-environment creation command. Confirm it is Python 3.12 or newer.

### Update your Windows checkout

Stop both servers first, then:

```powershell
git pull --ff-only
.\setup_windows.bat
.\start_platform.bat
```

Setup seeds sample station data only when the database is new; existing readings are kept. To deliberately reset station configuration to the sample defaults, stop the servers and run `seed_stations` manually from `backend`.

### Windows troubleshooting

- **Python or Node not found:** reinstall with PATH enabled and reopen your terminal. Check `py -3 --version` or `python --version`, and `node --version`.
- **`npm.ps1` blocked:** use `npm.cmd`, as shown above. The batch launchers already do this.
- **Port 8000 or 5173 occupied:** stop the previous server terminal before starting another instance. The frontend uses a strict port so it cannot silently move to a different address.
- **Dashboard cannot connect:** check the backend terminal for errors and open the backend API link above. Access the website through port 5173; Vite forwards API and WebSocket requests to port 8000.
- **Blank 3D scene:** enable browser graphics acceleration and update your graphics driver. Try a current Edge or Chrome browser.
- **Dependency download fails:** confirm internet access and inspect the installer error. On a managed network with certificate inspection, use the organisation's trusted certificate configuration; do not disable certificate verification.
- **SQLite database locked:** stop duplicate backend processes. The default prototype uses a local SQLite database.
- **Weather API unavailable:** the application has fallback weather values and can still demonstrate simulated operation.

## Current technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, JavaScript, Vite 8 |
| Styling and charts | CSS, Tailwind CSS 4, Recharts, Lucide React |
| 3D | Three.js, React Three Fiber, Drei |
| Backend | Python, Django, Django REST Framework |
| Live updates | Django Channels, Daphne, WebSocket, HTTP fallback |
| Local database | SQLite |
| ML | scikit-learn, NumPy, SciPy, Isolation Forest, Ridge Regression |
| Weather | Open-Meteo via Python requests, with fallback |

Redis, Celery and Docker configuration exist in the repository. The default local run uses the in-memory Channels layer and does not require these services. If enabling the Redis channel layer, install `channels-redis` and configure `REDIS_URL`.

## macOS / Linux manual run

Prerequisites: Python 3.12+, Node.js 24 LTS (or 22.12+), and Git.

```bash
git clone https://github.com/Rajgaurav04/Antarctic-Digital-Twin.git
cd Antarctic-Digital-Twin
python3 -m venv backend/venv
backend/venv/bin/python -m pip install --upgrade pip
backend/venv/bin/python -m pip install -r backend/requirements.txt
cd backend
venv/bin/python manage.py migrate
venv/bin/python manage.py seed_stations
venv/bin/python -m daphne -b 127.0.0.1 -p 8000 antarctic_ops.asgi:application
```

In a second terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

## Project structure

```text
backend/
  antarctic_ops/                  Django settings and server routing
  stations_twin/                 Models, simulation, APIs and WebSocket consumer
    management/commands/         Database seeding and simulator commands
    ml/                          Health analysis and fuel forecasts
    services/                    Weather API integration
  requirements.txt
frontend/
  src/components/dashboard/      Operations dashboard
  src/components/twin/           3D station, tours, workflows and weather
  src/api/                       API and WebSocket client
  src/context/                   Theme state
setup_windows.bat                First-time setup / dependency updates
start_platform.bat               Windows server launcher
README.md                        Setup and usage instructions
```

## Explore the prototype

1. Choose Maitri or Bharati on the dashboard.
2. Open the 3D twin and select a workflow to follow its route.
3. Select **Auto Tour** for a guided introduction; use Previous, Next, Pause and Resume.
4. Use **Interior cutaway** for represented rooms, and move directly in the normal view with **W/A/S/D**, **Space** (up), **Ctrl** (down) and **Shift** (boost).
5. Try the **WEATHER** controls for scene previews.
6. Open **Telemetry** and run an incident exercise. Observe the affected equipment and readings, then restore nominal state.

## Deployment status

This is a local demonstration prototype. Real station feeds, validation against real operational records, production permissions, secure deployment configuration and operational acceptance remain future work.

Windows instructions and launchers were prepared on macOS; an actual Windows execution has not been performed.

## References

- [NCPOR — Maitri](https://ncpor.res.in/pages/view/260/256-maitri)
- [NCPOR — Antarctic station overview](https://npdc.ncpor.res.in/npdc/antarctica_home.action)
- [Open-Meteo](https://open-meteo.com/)

The project retains its upstream Git history from [Nishant-095/Antarctic-Digital-Twin](https://github.com/Nishant-095/Antarctic-Digital-Twin).

### Vibration and exercise indicators

Triaxial vibration is simulated in **nm/s²** as √(Z² + N² + E²). The demo envelopes below were supplied for this prototype; they are not independently validated station measurements or engineering safety limits.

| Simulation band | Maitri (nm/s²) | Bharati (nm/s²) |
| --- | --- | --- |
| Dead calm | 7.1–22 | 8.5–25 |
| Ambient | 22–115 | 25–140 |
| Seasonal reference | 173–866 | 220–950 |
| Blizzard exercise | 1,732–86,602 | 2,000–92,000 |

The current simulator selects calm, ambient or blizzard based on wind and the active exercise. The seasonal envelope is documented for reference, not driven by a sea-ice model. Blizzard magnitude varies with wind severity within its band. Earlier vibration history retains its original unit in reading metadata. Abnormal cards and affected workspace sections show red indicators; failures such as a disabled trace heater are marked even when zero is inside the numeric sensor range.

### Blizzard scene and terrain

An active blizzard exercise overrides mild/cold scene previews. Snow particles and fast wind-aligned streaks show blowing snow; reduced-motion preferences retain a static snow field. Floating sensor cards and pointer lines stay crisp and unaffected by atmospheric fog.

Oversized scattered boulders have been removed. Continuous bedrock rises and snowfields interpret Maitri’s Schirmacher Oasis setting and Bharati’s coastal promontory in Larsemann Hills, retaining the lake and coastal water. This is an illustrative reconstruction, not surveyed terrain. Setting reference: [NCPOR Antarctic stations](https://npdc.ncpor.res.in/npdc/antarctica_home.action).
