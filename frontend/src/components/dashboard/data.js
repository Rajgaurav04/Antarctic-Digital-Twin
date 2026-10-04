export const displayNumber = (value, digits = 1) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-IN', {minimumFractionDigits: digits, maximumFractionDigits: digits}) : '—';
export const systemLabels = {POWER_CHP:'Power generation', BATTERY_STORAGE:'Battery & backup', FUEL_STORAGE:'Fuel reserves', WATER_INTAKE:'Water intake', HVAC_GLYCOL:'Heating & ventilation', STRUCTURAL_HEALTH:'Habitat & structure', WEATHER:'Weather monitoring'};
export const incidentLabels = {BLIZZARD_ALERT:'Blizzard exercise', LAKE_PIPE_FREEZE:'Water pipeline freeze exercise', CHP_GEN2_TRIP:'Generator 2 trip exercise', GLYCOL_PRESSURE_DROP:'Heating pressure loss exercise'};
const incidentSystems = {
 BLIZZARD_ALERT:['WEATHER','STRUCTURAL_HEALTH','BATTERY_STORAGE'],
 LAKE_PIPE_FREEZE:['WATER_INTAKE'], CHP_GEN2_TRIP:['POWER_CHP','BATTERY_STORAGE'], GLYCOL_PRESSURE_DROP:['HVAC_GLYCOL']
};
const incidentSensors = {
 BLIZZARD_ALERT:['WIND_SPEED','VIBRATION_INDEX','BATTERY_CURRENT'],
 LAKE_PIPE_FREEZE:['LAKE_PIPE_TEMP','LAKE_FLOW_RATE','TRACE_HEATER_KW','TRACE_HEATER_STATUS'],
 CHP_GEN2_TRIP:['CHP2_KW','BATTERY_CURRENT'],
 GLYCOL_PRESSURE_DROP:['GLYCOL_PRESSURE','GLYCOL_SUPPLY_TEMP','GLYCOL_RETURN_TEMP','GLYCOL_FLOW_RATE']
};
export function sensorWarning(sensor, telemetry) {
 return Boolean(sensor.is_anomaly || incidentSensors[telemetry?.active_incident]?.includes(sensor.sensor_code) ||
  (Number.isFinite(sensor.current_value) && ((sensor.safe_min != null && sensor.current_value < sensor.safe_min) || (sensor.safe_max != null && sensor.current_value > sensor.safe_max))));
}
export function weatherWarning(telemetry, metric) {
 const k=telemetry?.kpis||{};
 return telemetry?.active_incident==='BLIZZARD_ALERT' || (metric==='wind' ? k.wind_speed>60 : k.ambient_temp<=-30);
}
export function systemState(system, telemetry) {
 if (incidentSystems[telemetry?.active_incident]?.includes(system.code)) return 'Attention';
 if ((system.status && system.status !== 'NOMINAL') || system.sensors?.some(s=>sensorWarning(s,telemetry))) return 'Attention';
 if (system.code==='WEATHER' && (weatherWarning(telemetry,'wind') || weatherWarning(telemetry,'temperature'))) return 'Attention';
 return 'Nominal';
}
export function sectionWarning(section, telemetry) {
 const groups={infrastructure:['WATER_INTAKE','HVAC_GLYCOL','STRUCTURAL_HEALTH'],energy:['POWER_CHP','BATTERY_STORAGE'],logistics:['FUEL_STORAGE'],environment:['WEATHER']};
 const any=Boolean(telemetry?.active_incident || telemetry?.alerts?.length || telemetry?.subsystems?.some(s=>systemState(s,telemetry)!=='Nominal'));
 if(section==='overview') return any;
 if(section==='exercises') return Boolean(telemetry?.active_incident);
 if(section==='analysis') return any || Boolean(telemetry?.ml_diagnostics?.is_anomaly);
 if(section==='environment' && (weatherWarning(telemetry,'wind')||weatherWarning(telemetry,'temperature'))) return true;
 return Boolean(telemetry?.subsystems?.some(s=>groups[section]?.includes(s.code)&&systemState(s,telemetry)!=='Nominal'));
}
