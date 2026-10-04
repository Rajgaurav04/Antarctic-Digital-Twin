import {sensorWarning} from './dashboard/data';
import React, {useState} from 'react';
import { X, Cpu, Gauge, Sliders } from 'lucide-react';
import useDialogFocus from '../hooks/useDialogFocus';
import { useTheme } from '../context/ThemeContext';

export default function SubsystemDetailModal({
  subsystemCode,
  onClose,
  stationSlug,
  telemetry,
  onTriggerCommand,
}) {
  const { isDark } = useTheme();
  const [refreshState,setRefreshState]=useState(null);
  const [isRefreshing,setIsRefreshing]=useState(false);
  const dialogRef=useDialogFocus(Boolean(subsystemCode),onClose);
  if (!subsystemCode) return null;

  const isMaitri = stationSlug === 'maitri';
  const subsystems = telemetry?.subsystems || [];

  // Find matching subsystem in telemetry data or provide rich fallback defaults
  const sub = subsystems.find((s) => s.code === subsystemCode) || {
    code: subsystemCode,
    name: subsystemCode.replace('_', ' '),
    status: 'UNAVAILABLE',
    description: 'No subsystem snapshot is available yet.',
  };

  const sensors = sub.sensors || [];

  const modalBg = isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-black shadow-2xl';
  const headerBg = isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200';
  const innerCardBg = isDark ? 'bg-slate-950/70 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-black font-medium';
  const tableHeaderBg = isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-black font-bold border-slate-200';
  const tableRowHover = isDark ? 'hover:bg-slate-900/50' : 'hover:bg-slate-50';
  const subText = isDark ? 'text-slate-400' : 'text-black font-medium';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none animate-fadeIn">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Subsystem sensor diagnostics" className={`w-full max-w-xl border rounded shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-colors ${modalBg}`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between transition-colors ${headerBg}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 border rounded ${isDark ? 'bg-slate-900 border-slate-700 text-sky-400' : 'bg-white border-slate-300 text-sky-600 shadow-xs'}`}>
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-black'}`}>
                  {sub.name}
                </h3>

              </div>
              <p className={`text-xs mt-0.5 ${subText}`}>
                {isMaitri ? 'Maitri Research Station' : 'Bharati Research Station'} • Diagnostic Hotspot
              </p>
            </div>
          </div>
          <button
            aria-label="Close subsystem sensor diagnostics"
            onClick={onClose}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* Subsystem Description */}
          <div className={`p-3 border rounded leading-relaxed transition-colors ${innerCardBg}`}>
            {sub.description}
          </div>

          {/* Subsystem Metadata Pill Grid */}
          {sub.telemetry_metadata && Object.keys(sub.telemetry_metadata).length > 0 && (
            <div className={`border rounded p-3 transition-colors ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`font-semibold uppercase text-[10px] tracking-wider block mb-2 ${subText}`}>
                Subsystem Parameters & Topology
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                {Object.entries(sub.telemetry_metadata).map(([key, value]) => (
                  <div key={key} className={`p-2 rounded border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                    <span className="text-slate-500 text-[9px] block uppercase truncate">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className={`font-bold truncate block ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                      {Array.isArray(value) ? value.join(', ') : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real-Time Sensor Telemetry Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`font-semibold uppercase text-xs tracking-wider flex items-center gap-1.5 ${isDark ? 'text-slate-200' : 'text-black'}`}>
                <Gauge className="w-3.5 h-3.5 text-sky-500" />
                Simulated sensor readings
              </span>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  SIMULATED
                </span>

              </div>
            </div>

            <div className={`border rounded overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <table className="w-full text-left font-mono text-xs">
                <thead className={`border-b text-[10px] uppercase ${tableHeaderBg}`}>
                  <tr>
                    <th className="p-2">Sensor Code</th>
                    <th className="p-2">Metric</th>
                    <th className="p-2 text-right">Value</th>
                    <th className="p-2 text-center">Thresholds</th>
                    <th className="p-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800/70 bg-slate-950/40' : 'divide-slate-200 bg-white'}`}>
                  {sensors.length === 0 ? (
                    <tr>
                      <td colSpan="5" className={`p-3 text-center ${isDark ? 'text-slate-500' : 'text-black'}`}>
                        Loading sensor bus telemetry...
                      </td>
                    </tr>
                  ) : (
                    sensors.map((s) => {
                      const valDisplay = typeof s.current_value === 'number'
                        ? (s.sensor_code === 'VIBRATION_INDEX'
                            ? s.current_value.toLocaleString('en-IN',{maximumFractionDigits:1})
                            : (s.sensor_code === 'FUEL_BURN_RATE' || s.sensor_code === 'GLYCOL_PRESSURE')
                            ? s.current_value.toFixed(2)
                            : s.current_value.toFixed(1))
                        : s.current_value;

                      return (
                        <tr key={s.id || s.sensor_code} className={`transition-colors ${tableRowHover}`}>
                          <td className={`p-2 font-bold ${isDark ? 'text-slate-200' : 'text-black'}`}>{s.sensor_code}</td>
                          <td className={`p-2 ${subText}`}>{s.name}</td>
                          <td className={`p-2 text-right font-bold ${sensorWarning(s,telemetry)?'text-red-600':isDark ? 'text-white' : 'text-black'}`}>
                            {valDisplay}{' '}
                            <span className={`font-normal ${subText}`}>{s.unit}</span>
                          </td>
                        <td className={`p-2 text-center text-[10px] ${isDark ? 'text-slate-500' : 'text-black font-medium'}`}>
                          {s.safe_min != null ? `${s.safe_min} - ${s.safe_max}` : 'N/A'}
                        </td>
                        <td className="p-2 text-right">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              sensorWarning(s,telemetry)
                                ? isDark ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-status-blink' : 'bg-rose-100 text-rose-800 border border-rose-300 animate-status-blink'
                                : isDark ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {sensorWarning(s,telemetry) ? 'ANOMALY' : 'NOMINAL'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`p-3 border rounded space-y-2 ${innerCardBg}`}>
            <h3 className="font-semibold text-xs">Diagnostic actions</h3>
            <p className="text-xs">Refresh requests the current simulator snapshot. Hardware calibration is not connected.</p>
            <div className="flex flex-wrap gap-2">
              <button aria-disabled={isRefreshing} aria-busy={isRefreshing} className="desk-primary" onClick={async()=>{
                if(isRefreshing)return;
                setIsRefreshing(true);setRefreshState(null);
                try {await onTriggerCommand?.('REFRESH');setRefreshState('Sensor snapshot refreshed.');}
                catch {setRefreshState('Refresh failed. Check the connection and retry.');}
                finally {setIsRefreshing(false);}
              }}>{isRefreshing?'Refreshing…':'Refresh sensor readings'}</button>
              <button disabled className="desk-link">Hardware calibration unavailable</button>
            </div>
            {refreshState&&<p role="status" className="text-xs">{refreshState}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-3 border-t flex justify-end transition-colors ${headerBg}`}>
          <button
            aria-label="Close subsystem sensor diagnostics"
            onClick={onClose}
            className={`px-4 py-1.5 rounded font-medium text-xs transition-colors cursor-pointer ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
            }`}
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}
