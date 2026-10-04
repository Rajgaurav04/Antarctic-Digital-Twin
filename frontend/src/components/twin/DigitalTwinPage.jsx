import React, { useState, useRef, useEffect } from 'react';
import StationCanvas from './StationCanvas';
import {
  Activity,
  ArrowLeft,
  BatteryCharging,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  Droplets,
  Gauge,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  Play,
  RadioTower,
  RefreshCw,
  Sun,
  Thermometer,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import './DigitalTwinPage.css';

export default function DigitalTwinPage({
  stationSlug,
  onStationChange,
  telemetry,
  connectionStatus,
  onBackToDashboard,
  onSelectHotspot,
  onTriggerIncident,
  onRestoreNominal,
  onManualSync,
  isSyncing,
  isSimulating,
  isModalOpen = false,
  selectedSubsystem = null,
}) {
  const { isDark, toggleTheme } = useTheme();
  const [activeWaypoint, setActiveWaypoint] = useState(0);
  const [waypointRevision,setWaypointRevision]=useState(0);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isTelemetryDrawerOpen, setIsTelemetryDrawerOpen] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [clocks, setClocks] = useState({ utc: '', operational: '', solar: '' });
  const [timeStandard, setTimeStandard] = useState('IST'); // 'IST' (Operational) or 'SOLAR' (Local Mean Time)
  const waypointScrollRef = useRef(null);

  const isMaitri = stationSlug === 'maitri';
  const kpis = telemetry?.kpis || {};
  const sim = telemetry?.simulation || {};
  const ml = telemetry?.ml_diagnostics || {};
  const activeIncident = telemetry?.active_incident;

  const windSpeed = kpis.wind_speed ?? (isMaitri ? 12.2 : 22.4);
  const powerKw = kpis.power_kw ?? (isMaitri ? 180.0 : 308.0);
  const thermalTemp = kpis.thermal_temp ?? (isMaitri ? 4.2 : 60.2);
  const fuelDays = kpis.fuel_days ?? (isMaitri ? 165.0 : 210.0);
  const batterySoc = kpis.battery_soc ?? sim.battery_soc ?? (isMaitri ? 97.4 : 98.2);
  const batteryVoltage = kpis.battery_voltage ?? sim.battery_voltage ?? (isMaitri ? 241.8 : 401.8);
  const batteryAutonomy = kpis.battery_autonomy ?? sim.battery_autonomy ?? (isMaitri ? 4.6 : 5.2);
  const batteryCurrent = kpis.battery_current ?? sim.battery_current ?? 8.0;
  const healthIndex = Math.max(0, Math.min(100, Number(ml.health_index ?? 84.5)));
  const batterySocPercent = Math.max(0, Math.min(100, Number(batterySoc)));
  const connectionState = (connectionStatus || 'CONNECTING').toUpperCase();
  const connectionTone = connectionState === 'LIVE'
    ? 'live'
    : connectionState === 'CONNECTING'
    ? 'pending'
    : connectionState === 'OFFLINE_BUFFER'
    ? 'degraded'
    : 'offline';
  const connectionLabel = connectionState === 'LIVE'
    ? 'STREAM LIVE'
    : connectionState === 'OFFLINE_BUFFER'
    ? 'POLLING FALLBACK'
    : connectionState;
  const incidentLabel = {
    BLIZZARD_ALERT: 'Blizzard alert',
    LAKE_PIPE_FREEZE: 'Lake intake freeze',
    CHP_GEN2_TRIP: 'CHP generator trip',
    GLYCOL_PRESSURE_DROP: 'Glycol pressure drop',
  }[activeIncident] || null;
  const utcClock = clocks.utc ? clocks.utc.split(',').slice(1).join(',').trim() : 'Syncing';
  const stationClock = timeStandard === 'IST' ? clocks.operational : clocks.solar;
  const stationClockValue = stationClock ? stationClock.split(' (')[0] : 'Syncing';
  const stationClockZone = stationClock && stationClock.includes('(')
    ? stationClock.slice(stationClock.indexOf('(') + 1, stationClock.indexOf(')'))
    : '—';

  // Station Clocks
  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      const utcStr = now.toUTCString().replace('GMT', 'UTC');

      const nowUtcMs = now.getTime();

      // 1. Mission Operational Time (IST: UTC+05:30)
      // Both Maitri and Bharati operate under NCPOR on Indian Standard Time (IST: UTC+05:30)
      // for operational mission control, base telemetry and communications.
      const istDate = new Date(nowUtcMs + (5 * 60 + 30) * 60 * 1000);
      const istH = String(istDate.getUTCHours()).padStart(2, '0');
      const istM = String(istDate.getUTCMinutes()).padStart(2, '0');
      const istS = String(istDate.getUTCSeconds()).padStart(2, '0');
      const opStr = `${istH}:${istM}:${istS} (UTC+05:30 IST)`;

      // 2. Geographical Local Mean Solar Time (LMT based on longitude):
      // - Bharati: 76°11'14" E (76.1872° E) -> +304.75 min (+5h 05m) -> UTC+05:05 LMT
      // - Maitri: 11°44'09" E (11.7358° E) -> +46.94 min (+0h 47m) -> UTC+00:47 LMT
      const isBharati = stationSlug === 'bharati';
      const solarOffsetMin = isBharati ? (76.1872 * 4) : (11.7358 * 4);
      const solarDate = new Date(nowUtcMs + Math.round(solarOffsetMin * 60 * 1000));
      const solarH = String(solarDate.getUTCHours()).padStart(2, '0');
      const solarM = String(solarDate.getUTCMinutes()).padStart(2, '0');
      const solarS = String(solarDate.getUTCSeconds()).padStart(2, '0');
      const solarOffsetLabel = isBharati ? 'UTC+05:05' : 'UTC+00:47';
      const solStr = `${solarH}:${solarM}:${solarS} (${solarOffsetLabel} LMT)`;

      // Single batched state update instead of 3 separate setState calls
      setClocks({ utc: utcStr, operational: opStr, solar: solStr });
    };
    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, [stationSlug]);

  // Fill the available viewport even when the embedded browser denies native fullscreen.
  const toggleBrowserFullscreen = () => {
    if (isBrowserFullscreen) {
      setIsBrowserFullscreen(false);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    } else {
      setIsBrowserFullscreen(true);
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };
  useEffect(() => {
    const changed = () => setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    const escape = e => { if (e.code === 'Escape') setIsBrowserFullscreen(false); };
    document.addEventListener('fullscreenchange', changed);
    window.addEventListener('keydown', escape);
    const oldOverflow = document.body.style.overflow;
    if (isBrowserFullscreen) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      window.removeEventListener('keydown', escape);
      document.body.style.overflow = oldOverflow;
    };
  }, [isBrowserFullscreen]);

  // Station Inspection Waypoints
  const maitriWaypoints = [
    {
      id: 0,
      title: 'Station Overview',
      subtitle: 'Schirmacher Oasis Aerial View',
      metric: `${powerKw.toFixed(0)} kW`,
      subsystem: null,
      camPos: [30, 26, 46],
      targetPos: [0, 2, 0],
    },
    {
      id: 1,
      title: 'Main station & water services',
      subtitle: 'Elevated living and science building',
      metric: 'Treatment Active',
      subsystem: 'STRUCTURAL_HEALTH',
      camPos: [23, 12, 21],
      targetPos: [0, 3, 0],
    },
    {
      id: 2,
      title: 'Priyadarshini Pipeline',
      subtitle: 'Trace Heated Surface Conduit',
      metric: `${thermalTemp.toFixed(1)}°C`,
      subsystem: 'WATER_INTAKE',
      camPos: [25, 9, -1],
      targetPos: [18, 1, -9],
    },
    {
      id: 3,
      title: 'Lake Intake Pump Skid',
      subtitle: 'Lake Shore Pump Terminal',
      metric: 'Intake Online',
      subsystem: 'WATER_INTAKE',
      camPos: [42, 8, -13],
      targetPos: [32, 1, -23],
    },
    {
      id: 4,
      title: 'Diesel Generator Bay',
      subtitle: 'Diesel generation & heat supply',
      metric: `${powerKw.toFixed(1)} kW`,
      subsystem: 'POWER_CHP',
      camPos: [-36, 12, 10],
      targetPos: [-25, 2, -3],
    },
    {
      id: 5,
      title: 'Bulk Fuel Depot & Rack',
      subtitle: 'A/B Tanks & Overhead Gantry',
      metric: `${fuelDays.toFixed(0)} Days`,
      subsystem: 'FUEL_STORAGE',
      camPos: [-41, 10, 31],
      targetPos: [-27, 2, 17],
    },
    {
      id: 6,
      title: 'AWS Met Mast & Radome',
      subtitle: 'Katabatic Wind Anemometer',
      metric: `${windSpeed.toFixed(1)} km/h`,
      subsystem: 'WEATHER',
      camPos: [30, 11, 26],
      targetPos: [21, 5, 17],
    },
    {
      id: 7,
      title: 'Central BESS & Station UPS',
      subtitle: 'Battery monitoring & plant annex',
      metric: `${batterySoc.toFixed(1)}% SOC`,
      subsystem: 'BATTERY_STORAGE',
      camPos: [-27, 8, 17],
      targetPos: [-18, 2, 6],
    },
  ];

  const bharatiWaypoints = [
    {
      id: 0,
      title: 'Station Overview',
      subtitle: 'Larsemann Hills Aerial View',
      metric: `${powerKw.toFixed(0)} kW`,
      subsystem: null,
      camPos: [54, 39, 67],
      targetPos: [0, 5, 0],
    },
    {
      id: 1,
      title: 'Aerodynamic container envelope',
      subtitle: 'Elevated Chassis on Stilts',
      metric: 'Vibration Safe',
      subsystem: 'STRUCTURAL_HEALTH',
      camPos: [39, 19, 34],
      targetPos: [0, 6, 0],
    },
    {
      id: 2,
      title: 'Glycol hydronic heating loop',
      subtitle: 'Underfloor Chassis Pipe Network',
      metric: `${thermalTemp.toFixed(1)}°C`,
      subsystem: 'HVAC_GLYCOL',
      camPos: [-29, 6, -20],
      targetPos: [-10, 4, -7],
    },
    {
      id: 3,
      title: '3x Tri-Gen CHP Microgrid',
      subtitle: 'Continuous Heat Recovery & Power',
      metric: `${powerKw.toFixed(1)} kW`,
      subsystem: 'POWER_CHP',
      camPos: [-37, 15, -23],
      targetPos: [-19, 5, -9],
    },
    {
      id: 4,
      title: 'Bulk Fuel Storage & Bridge',
      subtitle: 'Ground Depot & Rising Truss',
      metric: `${fuelDays.toFixed(0)} Days`,
      subsystem: 'FUEL_STORAGE',
      camPos: [-55, 12, 32],
      targetPos: [-38, 2, 17],
    },
    {
      id: 5,
      title: 'West helipad & cargo approach',
      subtitle: 'External ground landing area',
      metric: 'Cargo access',
      subsystem: 'STRUCTURAL_HEALTH',
      camPos: [-62, 16, 39],
      targetPos: [-48, 0, 25],
    },
    {
      id: 6,
      title: 'Coastal Met Mast & AWS',
      subtitle: 'Katabatic Gale Velocity Mast',
      metric: `${windSpeed.toFixed(1)} km/h`,
      subsystem: 'WEATHER',
      camPos: [45, 15, 35],
      targetPos: [33, 5, 21],
    },
    {
      id: 7,
      title: 'Microgrid BESS & UPS Inverters',
      subtitle: 'Electrical services & UPS',
      metric: `${batterySoc.toFixed(1)}% SOC`,
      subsystem: 'BATTERY_STORAGE',
      camPos: [-35, 9, 23],
      targetPos: [-19, 5, 8],
    },
  ];

  const waypoints = isMaitri ? maitriWaypoints : bharatiWaypoints;
  const currentWp = waypoints[activeWaypoint] || waypoints[0];

  // Scroll through waypoints horizontally
  const scrollWaypoints = (direction) => {
    if (waypointScrollRef.current) {
      const scrollAmount = direction === 'left' ? -240 : 240;
      waypointScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Mouse wheel horizontal scrolling for waypoints reel
  useEffect(() => {
    const el = waypointScrollRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 0.9;
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Auto-scroll active card into view
  useEffect(() => {
    if (waypointScrollRef.current && waypointScrollRef.current.children[activeWaypoint]) {
      const activeEl = waypointScrollRef.current.children[activeWaypoint];
      const track = waypointScrollRef.current;
      track.scrollTo({left: Math.max(0, activeEl.offsetLeft - track.offsetLeft - (track.clientWidth - activeEl.clientWidth) / 2), behavior: 'smooth'});
    }
  }, [activeWaypoint]);

  const handleSelectWaypoint = (idx) => {
    setActiveWaypoint(idx);
    setWaypointRevision(value=>value+1);
  };

  // Keyboard navigation for waypoints (Left/Right arrow keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') {
        setActiveWaypoint((prev) => Math.min(waypoints.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setActiveWaypoint((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [waypoints.length]);


  return (
    <div className={'dt-page ' + (isDark ? 'dt-theme-dark' : 'dt-theme-light') + (isBrowserFullscreen ? ' dt-immersive' : '')}>
      <header className="dt-topbar">
        <div className="dt-brand">
          <button
            className="dt-back-button"
            onClick={onBackToDashboard}
            aria-label="Back to operations dashboard"
            title="Back to operations dashboard"
          >
            <ArrowLeft aria-hidden="true" />
          </button>

          <div className="dt-brand-mark" aria-hidden="true">
            <RadioTower />
          </div>
          <div className="dt-brand-copy">
            <span className="dt-brand-kicker">INDIAN POLAR OPERATIONS</span>
            <span className="dt-brand-title">FIELD TWIN <span>/ NCPOR</span></span>
          </div>
        </div>

        <nav className="dt-station-switch" aria-label="Research station">
          <button
            onClick={() => {
              onStationChange('maitri');
              setActiveWaypoint(0);
            }}
            aria-pressed={activeStationSlug(stationSlug) === 'maitri'}
            title="Maitri Research Station · Schirmacher Oasis · 11°44′ E"
            className={'dt-station-option dt-station-maitri' + (activeStationSlug(stationSlug) === 'maitri' ? ' is-selected' : '')}
          >
            <span className="dt-station-signal" aria-hidden="true" />
            <span className="dt-station-name">Maitri</span>
            <span className="dt-station-coordinate">11°44′ E</span>
          </button>
          <button
            onClick={() => {
              onStationChange('bharati');
              setActiveWaypoint(0);
            }}
            aria-pressed={activeStationSlug(stationSlug) === 'bharati'}
            title="Bharati Research Station · Larsemann Hills · 76°11′ E"
            className={'dt-station-option dt-station-bharati' + (activeStationSlug(stationSlug) === 'bharati' ? ' is-selected' : '')}
          >
            <span className="dt-station-signal" aria-hidden="true" />
            <span className="dt-station-name">Bharati</span>
            <span className="dt-station-coordinate">76°11′ E</span>
          </button>
        </nav>

        <div className="dt-header-tools">
          <div className="dt-clock-readout">
            <div className="dt-clock-utc">
              <Clock3 aria-hidden="true" />
              <span className="dt-clock-label">UTC</span>
              <span className="dt-clock-value">{utcClock}</span>
            </div>
            <button
              className="dt-clock-station"
              onClick={() => setTimeStandard((prev) => prev === 'IST' ? 'SOLAR' : 'IST')}
              aria-label={'Switch station clock. Current: ' + stationClockZone}
              aria-pressed={timeStandard === 'SOLAR'}
              title={timeStandard === 'IST'
                ? 'Mission time is India Standard Time. Click to show local mean solar time.'
                : 'Mission time is local mean solar time. Click to show India Standard Time.'}
            >
              <Compass aria-hidden="true" />
              <span className="dt-clock-label">STATION</span>
              <span className="dt-clock-value">{stationClockValue}</span>
              <span className="dt-clock-zone">{timeStandard === 'IST' ? 'IST' : 'SOLAR LMT'}</span>
            </button>
          </div>

          <div className={'dt-connection-status is-' + connectionTone} role="status" aria-live="polite">
            <span className="dt-status-dot" aria-hidden="true" />
            <span>{connectionLabel}</span>
          </div>

          <button
            className="dt-tool-button dt-sync-button"
            onClick={onManualSync}
            disabled={isSyncing}
            aria-busy={isSyncing}
            aria-label={isSyncing ? 'Syncing weather data' : 'Sync weather data'}
            title={isSyncing ? 'Syncing weather data…' : 'Sync weather data'}
          >
            <RefreshCw className={isSyncing ? 'dt-icon is-spinning' : 'dt-icon'} aria-hidden="true" />
            <span className="dt-tool-label">{isSyncing ? 'SYNCING' : 'SYNC'}</span>
          </button>

          <button
            className={'dt-tool-button dt-telemetry-button' + (isTelemetryDrawerOpen ? ' is-active' : '')}
            onClick={() => setIsTelemetryDrawerOpen((prev) => !prev)}
            aria-expanded={isTelemetryDrawerOpen}
            aria-controls="dt-ops-drawer"
            aria-label={isTelemetryDrawerOpen ? 'Close telemetry and controls' : 'Open telemetry and controls'}
            title={isTelemetryDrawerOpen ? 'Close telemetry and controls' : 'Open telemetry and controls'}
          >
            <Activity aria-hidden="true" />
            <span className="dt-tool-label">TELEMETRY</span>
          </button>

          <button
            className="dt-tool-button dt-icon-only"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>

          <button
            className="dt-tool-button dt-icon-only"
            onClick={toggleBrowserFullscreen}
            aria-pressed={isBrowserFullscreen}
            aria-label={isBrowserFullscreen ? 'Exit browser fullscreen' : 'Enter browser fullscreen'}
            title={isBrowserFullscreen ? 'Exit browser fullscreen' : 'Enter browser fullscreen'}
          >
            {isBrowserFullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="dt-main">
        <section className="dt-sitebar" aria-label="Selected station">
          <div className="dt-site-identity">
            <span className="dt-site-eyebrow">
              <span className="dt-site-live-mark" aria-hidden="true" />
              ANTARCTIC RESEARCH STATION
            </span>
            <h1 className="dt-site-title">
              {isMaitri ? 'Maitri' : 'Bharati'}
              <span> {isMaitri ? 'Schirmacher Oasis' : 'Larsemann Hills'}</span>
            </h1>
            <p className="dt-site-location">
              {isMaitri
                ? 'Queen Maud Land · East Antarctica · 70°45′58″ S, 11°44′09″ E'
                : 'East Antarctica · 69°24′28″ S, 76°11′14″ E'}
            </p>
          </div>

          <div className="dt-site-readouts" aria-label="Station summary">
            <div className="dt-readout">
              <span className="dt-readout-label"><Wind aria-hidden="true" /> WIND</span>
              <strong className={activeIncident==='BLIZZARD_ALERT'?'dt-danger-value':''}>{windSpeed.toFixed(1)} <small>km/h</small></strong>
            </div>
            <div className="dt-readout">
              <span className="dt-readout-label"><Thermometer aria-hidden="true" /> THERMAL LOOP</span>
              <strong>{thermalTemp.toFixed(1)} <small>°C</small></strong>
            </div>
            <div className="dt-readout">
              <span className="dt-readout-label"><Zap aria-hidden="true" /> GENERATION</span>
              <strong>{powerKw.toFixed(0)} <small>kW</small></strong>
            </div>
            <div className={'dt-incident-readout' + (incidentLabel ? ' is-alert' : '')}>
              <span className="dt-readout-label">
                <span className="dt-incident-dot" aria-hidden="true" />
                {incidentLabel ? 'ACTIVE INCIDENT' : 'SYSTEM STATE'}
              </span>
              <strong>{incidentLabel || 'Nominal operations'}</strong>
            </div>
          </div>
        </section>

        <section className={"dt-stage" + (isTelemetryDrawerOpen ? " has-drawer" : "")} aria-label="Interactive three-dimensional station model">
          <div className="dt-canvas-viewport">
            <StationCanvas
              isTourActive={isTourActive}
              onTourActiveChange={setIsTourActive}
              stationSlug={stationSlug}
              telemetry={telemetry}
              onSelectHotspot={onSelectHotspot}
              isFullscreen={isBrowserFullscreen}
              onToggleFullscreen={toggleBrowserFullscreen}
              onToggleTelemetry={()=>setIsTelemetryDrawerOpen(v=>!v)}
              cameraTargetPosition={currentWp.camPos}
              cameraTargetLookAt={currentWp.targetPos}
              waypointTrigger={`${stationSlug}-${activeWaypoint}-${waypointRevision}`}
              isModalOpen={isModalOpen}
              activeSubsystem={selectedSubsystem}
            />
          </div>

          {isTelemetryDrawerOpen && (
            <aside
              id="dt-ops-drawer"
              className="dt-ops-drawer"
              aria-labelledby="dt-ops-drawer-title"
            >
              <div className="dt-drawer-header">
                <div>
                  <span className="dt-section-eyebrow"><span className="dt-drawer-live-dot" /> LIVE SYSTEMS</span>
                  <h2 id="dt-ops-drawer-title">Telemetry & response</h2>
                </div>
                <button
                  className="dt-close-button"
                  onClick={() => setIsTelemetryDrawerOpen(false)}
                  aria-label="Close telemetry and controls"
                  title="Close telemetry and controls"
                >
                  <X aria-hidden="true" />
                </button>
              </div>

              <div className="dt-quick-metrics">
                <article className="dt-metric-card">
                  <span className="dt-card-label"><Zap aria-hidden="true" /> TOTAL POWER</span>
                  <strong>{powerKw.toFixed(1)}<small> kW</small></strong>
                </article>
                <article className="dt-metric-card">
                  <span className="dt-card-label"><Thermometer aria-hidden="true" /> THERMAL LOOP</span>
                  <strong>{thermalTemp.toFixed(1)}<small> °C</small></strong>
                </article>
                <article className="dt-metric-card">
                  <span className="dt-card-label"><Wind aria-hidden="true" /> KATABATIC WIND</span>
                  <strong className={activeIncident==='BLIZZARD_ALERT'?'dt-danger-value':''}>{windSpeed.toFixed(1)}<small> km/h</small></strong>
                </article>
                <article className="dt-metric-card">
                  <span className="dt-card-label"><Gauge aria-hidden="true" /> FUEL AUTONOMY</span>
                  <strong>{fuelDays.toFixed(0)}<small> days</small></strong>
                </article>
              </div>

              <article className="dt-battery-card">
                <div className="dt-battery-heading">
                  <div>
                    <span className="dt-card-label"><BatteryCharging aria-hidden="true" /> ENERGY STORAGE</span>
                    <strong>{isMaitri ? 'Central BESS / Station UPS' : 'Microgrid BESS / UPS'}</strong>
                  </div>
                  <span className={'dt-charge-state ' + (batteryCurrent < 0 ? 'is-discharging' : 'is-charged')}>
                    {batteryCurrent < 0 ? 'DISCHARGING' : 'FLOAT CHARGED'}
                  </span>
                </div>
                <div className="dt-battery-values">
                  <strong>{batterySoc.toFixed(1)}<small>% SOC</small></strong>
                  <span>{batteryVoltage.toFixed(1)} V DC</span>
                  <span>{batteryAutonomy.toFixed(1)} h autonomy</span>
                </div>
                <div
                  className="dt-meter-track"
                  role="meter"
                  aria-label="Battery state of charge"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={batterySocPercent}
                >
                  <span className="dt-meter-fill is-battery" style={{ width: batterySocPercent + '%' }} />
                </div>
              </article>

              <article className="dt-health-card">
                <div className="dt-health-heading">
                  <div>
                    <span className="dt-card-label"><Activity aria-hidden="true" /> POLAR HEALTH INDEX</span>
                    <strong>Machine-learning diagnostics</strong>
                  </div>
                  <span className="dt-health-value">{healthIndex.toFixed(1)}<small>%</small></span>
                </div>
                <div
                  className="dt-meter-track"
                  role="meter"
                  aria-label="Polar health index"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={healthIndex}
                >
                  <span className="dt-meter-fill is-health" style={{ width: healthIndex + '%' }} />
                </div>
              </article>

              <section className="dt-incident-section" aria-labelledby="dt-incident-title">
                <div className="dt-incident-heading">
                  <div>
                    <span className="dt-section-eyebrow">OPERATOR EXERCISES</span>
                    <h3 id="dt-incident-title">Incident response</h3>
                  </div>
                  {isSimulating && (
                    <span className="dt-dispatching" role="status" aria-live="polite">
                      <span className="dt-dispatch-dot" /> DISPATCHING
                    </span>
                  )}
                </div>

                {incidentLabel && (
                  <div className="dt-active-incident" role="status">
                    <span className="dt-alert-symbol"><Activity aria-hidden="true" /></span>
                    <span><strong>{incidentLabel}</strong><small>Response scenario currently active</small></span>
                  </div>
                )}

                <div className="dt-incident-actions">
                  <button
                    onClick={() => onTriggerIncident('BLIZZARD_ALERT')}
                    disabled={isSimulating}
                    aria-busy={isSimulating}
                    className={'dt-incident-button is-wind' + (activeIncident === 'BLIZZARD_ALERT' ? ' is-selected' : '')}
                  >
                    <Wind aria-hidden="true" />
                    <span><strong>Blizzard 98 km/h</strong><small>Severe wind event</small></span>
                  </button>

                  {isMaitri ? (
                    <button
                      onClick={() => onTriggerIncident('LAKE_PIPE_FREEZE')}
                      disabled={isSimulating}
                      aria-busy={isSimulating}
                      className={'dt-incident-button is-freeze' + (activeIncident === 'LAKE_PIPE_FREEZE' ? ' is-selected' : '')}
                    >
                      <Droplets aria-hidden="true" />
                      <span><strong>Lake pipe freeze</strong><small>Intake heat failure</small></span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onTriggerIncident('CHP_GEN2_TRIP')}
                      disabled={isSimulating}
                      aria-busy={isSimulating}
                      className={'dt-incident-button is-power' + (activeIncident === 'CHP_GEN2_TRIP' ? ' is-selected' : '')}
                    >
                      <Zap aria-hidden="true" />
                      <span><strong>CHP unit 2 trip</strong><small>Generator load transfer</small></span>
                    </button>
                  )}
                  {!isMaitri && <button onClick={() => onTriggerIncident('GLYCOL_PRESSURE_DROP')} disabled={isSimulating} className={'dt-incident-button is-freeze' + (activeIncident === 'GLYCOL_PRESSURE_DROP' ? ' is-selected' : '')}><Thermometer aria-hidden="true"/><span><strong>Glycol pressure drop</strong><small>Hydronic loop pressure loss</small></span></button>}
                </div>

                <button
                  onClick={onRestoreNominal}
                  disabled={isSimulating}
                  aria-busy={isSimulating}
                  className="dt-restore-button"
                >
                  <CheckCircle2 aria-hidden="true" />
                  <span>{isSimulating ? 'Command in progress…' : 'Restore nominal state'}</span>
                </button>
              </section>
            </aside>
          )}

          </section>
          <section className="dt-waypoint-dock" aria-label="Camera inspection route">
            <div className="dt-dock-heading">
              <div className="dt-dock-current">
                <span className="dt-section-eyebrow">CAMERA WAYPOINTS</span>
                <strong>{currentWp.title}</strong>
                <span className="dt-current-description">{currentWp.subtitle}</span>
              </div>
              <div className="dt-dock-tools">
                <span className="dt-waypoint-count" aria-live="polite">
                  <span>{String(activeWaypoint + 1).padStart(2, '0')}</span> / {String(waypoints.length).padStart(2, '0')}
                </span>
                <button
                  onClick={() => setIsTourActive((prev) => !prev)}
                  aria-pressed={isTourActive}
                  aria-label={isTourActive ? 'Pause guided station tour' : 'Start guided station tour'}
                  title={isTourActive ? 'Pause guided station tour' : 'Start guided station tour'}
                  className={'dt-tour-button' + (isTourActive ? ' is-active' : '')}
                >
                  {isTourActive ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  <span>{isTourActive ? 'PAUSE TOUR' : 'AUTO TOUR'}</span>
                </button>
              </div>
            </div>

            <div className="dt-waypoint-row">
              <button
                className="dt-waypoint-arrow"
                onClick={() => scrollWaypoints('left')}
                aria-label="Scroll camera waypoints left"
                title="Scroll camera waypoints left"
              >
                <ChevronLeft aria-hidden="true" />
              </button>

              <div
                ref={waypointScrollRef}
                className="dt-waypoint-track"
                role="group"
                aria-label="Camera waypoints"
              >
                {waypoints.map((wp, idx) => {
                  const isActive = activeWaypoint === idx;
                  return (
                    <button
                      key={wp.id}
                      onClick={() => {
                        handleSelectWaypoint(idx);
                        if (isTourActive) setIsTourActive(false);
                      }}
                      className={'dt-waypoint-card' + (isActive ? ' is-active' : '')}
                      aria-current={isActive ? 'step' : undefined}
                      aria-label={'View ' + wp.title + '. ' + wp.subtitle + '. ' + wp.metric}
                      title={wp.title + ' · ' + wp.subtitle}
                    >
                      <span className="dt-waypoint-topline">
                        <span className="dt-waypoint-index">{String(idx + 1).padStart(2, '0')}</span>
                        <span className="dt-waypoint-metric">{wp.metric}</span>
                      </span>
                      <span className="dt-waypoint-title">{wp.title}</span>
                      <span className="dt-waypoint-subtitle">{wp.subtitle}</span>
                    </button>
                  );
                })}
              </div>

              <button
                className="dt-waypoint-arrow"
                onClick={() => scrollWaypoints('right')}
                aria-label="Scroll camera waypoints right"
                title="Scroll camera waypoints right"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </section>
      </main>
    </div>
  );
}

function activeStationSlug(slug) {
  return slug === 'maitri' ? 'maitri' : 'bharati';
}
