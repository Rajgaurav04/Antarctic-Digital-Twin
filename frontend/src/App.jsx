import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import Header from './components/Header';
const DashboardLanding = lazy(() => import('./components/DashboardLanding'));
const DigitalTwinPage = lazy(() => import('./components/twin/DigitalTwinPage'));
import AlertsDrawer from './components/AlertsDrawer';
import SubsystemDetailModal from './components/SubsystemDetailModal';
import { useTheme } from './context/ThemeContext';
import {
  fetchStationTelemetry,
  fetchStationHistory,
  triggerIncident,
  restoreNominal,
  syncWeather,
  createTelemetrySocket,
} from './api/client';

export default function App() {
  const { isDark } = useTheme();
  const [activeStation, setActiveStation] = useState('maitri');
  const [activeView, setActiveView] = useState(() => {
    return window.location.hash === '#/twin' ? 'twin' : 'dashboard';
  });
  const [telemetry, updateTelemetry] = useState(null);
  // REST commands and streaming ticks can arrive out of order. Never restore an older alert state.
  const setTelemetry = useCallback((snapshot) => updateTelemetry(previous => {
    const next = typeof snapshot === 'function' ? snapshot(previous) : snapshot;
    if (!next) return next;
    if (previous?.station_slug === next.station_slug &&
        Date.parse(next.timestamp) < Date.parse(previous.timestamp)) return previous;
    return next;
  }), []);
  const [history, setHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING');
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [selectedSubsystem, setSelectedSubsystem] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSyncingWeather, setIsSyncingWeather] = useState(false);
  const [isExecutingFailSafe, setIsExecutingFailSafe] = useState(false);

  const [commandFeedback, setCommandFeedback] = useState(null);
  const stationRef = useRef(activeStation);
  const socketRef = useRef(null);
  const pollTimerRef = useRef(null);

  // Sync hash routing
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#/twin') {
        setActiveView('twin');
      } else {
        setActiveView('dashboard');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => { document.title = `Polar station operations · ${activeStation === 'maitri' ? 'Maitri' : 'Bharati'} · ${activeView === 'twin' ? 'Digital twin' : 'Dashboard'}`; }, [activeStation, activeView]);

  const handleViewChange = (view) => {
    setActiveView(view);
    window.location.hash = view === 'twin' ? '#/twin' : '#/dashboard';
  };

  // Load initial telemetry & history via REST API
  const loadInitialData = useCallback(async (slug) => {
    try {
      const [telData, histData] = await Promise.all([
        fetchStationTelemetry(slug).catch(() => null),
        fetchStationHistory(slug).catch(() => null),
      ]);

      if (stationRef.current !== slug) return;
      if (telData) {
        setTelemetry(telData);
      }
      if (histData && Array.isArray(histData.history)) {
        setHistory(histData.history);
      }
    } catch (err) {
      console.warn("REST initialization error:", err);
    }
  }, []);

  // Set up WebSocket telemetry stream with automatic HTTP polling fallback
  useEffect(() => {
    let disposed = false;
    // 1. Initial REST fetch
    loadInitialData(activeStation);

    // 2. Clear prior connections
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    clearInterval(pollTimerRef.current);

    let lastMessageTimestamp = Date.now();

    // 3. Connect WebSocket
    const wsClient = createTelemetrySocket(
      activeStation,
      (message) => {
        if (disposed) return;
        if (
          message.type === 'TELEMETRY_TICK' ||
          message.type === 'CONNECTION_ESTABLISHED' ||
          message.type === 'NOMINAL_RESTORED' ||
          message.type === 'INCIDENT_TRIGGERED'
        ) {
          lastMessageTimestamp = Date.now();
          const tickData = message.telemetry || message.data?.telemetry || message.data;
          if (tickData && tickData.station_slug === activeStation) {
            setTelemetry((prev) => {
              const merged = {
                ...(prev || {}),
                ...tickData,
                timestamp: tickData.timestamp ?? new Date().toISOString(),
                kpis: {
                  power_kw: tickData.kpis?.power_kw ?? tickData.total_power_kw ?? prev?.kpis?.power_kw,
                  fuel_days: tickData.kpis?.fuel_days ?? tickData.fuel_reserve_days ?? prev?.kpis?.fuel_days,
                  thermal_temp: tickData.kpis?.thermal_temp ?? tickData.primary_thermal_temp ?? prev?.kpis?.thermal_temp,
                  wind_speed: tickData.kpis?.wind_speed ?? tickData.wind_speed ?? prev?.kpis?.wind_speed,
                  ambient_temp: tickData.kpis?.ambient_temp ?? tickData.ambient_temp ?? prev?.kpis?.ambient_temp,
                  surface_pressure: tickData.kpis?.surface_pressure ?? tickData.surface_pressure ?? prev?.kpis?.surface_pressure,
                  solar_radiation: tickData.kpis?.solar_radiation ?? tickData.solar_radiation ?? prev?.kpis?.solar_radiation,
                  trace_heating_active: tickData.kpis?.trace_heating_active ?? tickData.trace_heating_active ?? prev?.kpis?.trace_heating_active,
                  battery_soc: tickData.kpis?.battery_soc ?? tickData.battery_soc ?? prev?.kpis?.battery_soc ?? 98.0,
                  battery_voltage: tickData.kpis?.battery_voltage ?? tickData.battery_voltage ?? prev?.kpis?.battery_voltage ?? (activeStation === 'maitri' ? 241.8 : 401.5),
                  battery_autonomy: tickData.kpis?.battery_autonomy ?? tickData.battery_autonomy ?? prev?.kpis?.battery_autonomy ?? (activeStation === 'maitri' ? 4.6 : 5.2),
                  battery_current: tickData.kpis?.battery_current ?? tickData.battery_current ?? prev?.kpis?.battery_current ?? 8.0,
                },
                subsystems: tickData.subsystems || prev?.subsystems || [],
                simulation: tickData.simulation || {},
                alerts: tickData.alerts || [],
                active_incident: tickData.active_incident,
              };
              return merged;
            });

            // Update real-time history stream for charts (debounced per second)
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-GB', {timeZone:'UTC', hour12:false});
            const powerVal = tickData.kpis?.power_kw ?? tickData.total_power_kw ?? null;
            const burnVal = tickData.simulation?.fuel_burn_rate ?? null;
            const thermVal = tickData.kpis?.thermal_temp ?? tickData.primary_thermal_temp ?? null;

            setHistory((prevHist) => {
              const last = prevHist[prevHist.length - 1];
              if (last && last.time === timeStr) {
                return [...prevHist.slice(0, -1), { time: timeStr, power_kw: powerVal, fuel_burn_lh: burnVal, thermal_temp: thermVal }];
              }
              const next = [...prevHist, { time: timeStr, power_kw: powerVal, fuel_burn_lh: burnVal, thermal_temp: thermVal }];
              return next.length > 25 ? next.slice(-25) : next;
            });
          }
        }
      },
      (status) => {
        if (disposed) return;
        setConnectionStatus(status);
        if (status === 'OFFLINE_BUFFER') {
          // Engage HTTP polling fallback every 2.0s
          if (!pollTimerRef.current) {
            pollTimerRef.current = setInterval(async () => {
              try {
                const latest = await fetchStationTelemetry(activeStation);
                if (latest && !disposed && stationRef.current === activeStation) {
                  setTelemetry(latest);
                }
              } catch (e) {
                // Buffer retry
              }
            }, 2000);
          }
        } else if (status === 'LIVE') {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    );

    // Watchdog: If no message has arrived in > 6s, perform a background fetch to ensure values never stall
    const watchdogInterval = setInterval(async () => {
      if (Date.now() - lastMessageTimestamp > 6000) {
        try {
          const latest = await fetchStationTelemetry(activeStation);
          if (latest && !disposed && stationRef.current === activeStation) {
            setTelemetry(latest);
            lastMessageTimestamp = Date.now();
          }
        } catch (e) {
          // Ignore transient network errors
        }
      }
    }, 5000);

    socketRef.current = wsClient;

    return () => {
      disposed = true;
      if (socketRef.current) {
        socketRef.current.close();
      }
      clearInterval(pollTimerRef.current);
      clearInterval(watchdogInterval);
    };
  }, [activeStation, loadInitialData]);

  // Handle station change
  const handleStationChange = (slug) => {
    if (slug !== activeStation) {
      stationRef.current = slug;
      setTelemetry(null);
      setHistory([]);
      setConnectionStatus('CONNECTING');
      setCommandFeedback(null);
      setActiveStation(slug);
      setSelectedSubsystem(null);
    }
  };

  // Commands report server-confirmed outcomes and preserve the last snapshot on failure.
  const handleTriggerIncident = async (incidentCode) => {
    if (isSimulating) return;
    const slug = activeStation;
    setIsSimulating(true);
    setCommandFeedback({text:'Applying exercise to the simulator…'});
    try {
      const res = await triggerIncident(slug, incidentCode);
      if (stationRef.current === slug) {
        if (res?.telemetry) setTelemetry(res.telemetry);
        setCommandFeedback({text:'Exercise applied. Inspect system readings and alerts, then restore nominal state.'});
      }
    } catch (err) {
      if (stationRef.current === slug) setCommandFeedback({error:true,text:'Exercise could not be applied. Check the backend connection and retry.'});
    } finally { setIsSimulating(false); }
  };

  const handleRestoreNominal = async () => {
    if (isSimulating) return false;
    const slug = activeStation;
    setIsSimulating(true);
    setCommandFeedback({text:'Restoring the simulated station…'});
    try {
      const res = await restoreNominal(slug);
      if (stationRef.current === slug) {
        if (res?.telemetry) setTelemetry(res.telemetry);
        setCommandFeedback({text:'Nominal state restored. The simulated incident has been cleared.'});
      }
      return true;
    } catch (err) {
      if (stationRef.current === slug) setCommandFeedback({error:true,text:'Restore failed. The last reported station state is retained; check the connection and retry.'});
      return false;
    } finally { setIsSimulating(false); }
  };

  // Execute fail-safe action from Alert Drawer
  const handleExecuteFailSafe = async (alertCode) => {
    setIsExecutingFailSafe(true);
    try {
      // Simulate remote SCADA automation sequence
      await new Promise((resolve) => setTimeout(resolve, 600));
      const restored = await handleRestoreNominal();
      if (restored) setIsAlertsOpen(false);
    } catch (err) {
      console.error("Failed to execute fail-safe:", err);
    } finally {
      setIsExecutingFailSafe(false);
    }
  };

  // Force manual sync with Open-Meteo
  const handleManualWeatherSync = async () => {
    setIsSyncingWeather(true);
    try {
      await syncWeather(activeStation);
      await loadInitialData(activeStation);
    } catch (err) {
      console.error("Weather sync failed:", err);
    } finally {
      setIsSyncingWeather(false);
    }
  };

  const activeIncident = telemetry?.active_incident;
  const alertCount = telemetry?.alerts?.length || 0;

  return (
    <div className={activeView === 'dashboard' ? 'dashboard-type-preview' : undefined}>
      <Suspense fallback={<div className="workspace-loading" role="status"><span>INDIAN POLAR OPERATIONS</span><strong>Loading station workspace…</strong></div>}>
      {activeView === 'dashboard' ? (
        <div className={`flex flex-col min-h-screen transition-colors overflow-x-hidden ${
          isDark ? 'bg-[#0b0f19] text-slate-100' : 'bg-white text-black'
        }`}>
          {/* 1. HEADER & STATION SWITCHER */}
          <Header
            activeStation={activeStation}
            onStationChange={handleStationChange}
            connectionStatus={connectionStatus}
            activeAlertCount={alertCount}
            onManualSync={handleManualWeatherSync}
            isSyncing={isSyncingWeather}
            currentView={activeView}
            onViewChange={handleViewChange}
          />

          {/* 2. DEDICATED OPERATIONS LANDING DASHBOARD (NO EMBEDDED 3D TWIN) */}
          <main className="flex-1">
            <DashboardLanding
              stationSlug={activeStation}
              connectionStatus={connectionStatus}
              commandFeedback={commandFeedback}
              telemetry={telemetry}
              history={history}
              onLaunchTwin={() => handleViewChange('twin')}
              onOpenAlerts={() => setIsAlertsOpen(true)}
              onSelectSubsystem={(code) => setSelectedSubsystem(code)}
              onTriggerIncident={handleTriggerIncident}
              onRestoreNominal={handleRestoreNominal}
              isSimulating={isSimulating}
            />
          </main>
        </div>
      ) : (
        /* DEDICATED FULLSCREEN 3D DIGITAL TWIN PAGE */
        <DigitalTwinPage
          stationSlug={activeStation}
          onStationChange={handleStationChange}
          telemetry={telemetry}
          connectionStatus={connectionStatus}
          onBackToDashboard={() => handleViewChange('dashboard')}
          onSelectHotspot={(code) => setSelectedSubsystem(code)}
          onTriggerIncident={handleTriggerIncident}
          onRestoreNominal={handleRestoreNominal}
          onManualSync={handleManualWeatherSync}
          isSyncing={isSyncingWeather}
          isSimulating={isSimulating}
          isModalOpen={Boolean(selectedSubsystem || isAlertsOpen)}
          selectedSubsystem={selectedSubsystem}
        />
      )}

      </Suspense>
      {/* 4. ALERTS & INCIDENT MANAGEMENT SLIDE-OVER */}
      <AlertsDrawer
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        alerts={telemetry?.alerts || []}
        stationName={activeStation === 'maitri' ? 'Maitri Research Station' : 'Bharati Research Station'}
        onExecuteFailSafe={handleExecuteFailSafe}
        isExecuting={isExecutingFailSafe}
      />

      {/* 5. 3D HOTSPOT SUBSYSTEM DETAIL MODAL */}
      <SubsystemDetailModal
        key={`${activeStation}-${selectedSubsystem || 'closed'}`}
        subsystemCode={selectedSubsystem}
        onClose={() => setSelectedSubsystem(null)}
        stationSlug={activeStation}
        telemetry={telemetry}
        onTriggerCommand={async () => {
          const slug=activeStation;
          const latest=await fetchStationTelemetry(slug);
          if(stationRef.current===slug) setTelemetry(latest);
        }}
      />
    </div>
  );
}
