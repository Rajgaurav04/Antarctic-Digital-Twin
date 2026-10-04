import math
import random
from datetime import datetime
from django.utils import timezone
from django.db import transaction
from .models import Station, Subsystem, Sensor, SensorReading, StationAlert

class AntarcticSimulator:
    """
    High-fidelity Antarctic Telemetry Simulation Engine.
    Models thermodynamic, electrical, and structural behaviors of Maitri & Bharati stations.
    """

    @staticmethod
    def _triaxial_vibration(slug, wind, incident):
        """Synthetic RSS acceleration in nm/s² using user-supplied demo bands."""
        bands = ({'calm': (7.1, 22), 'ambient': (22, 115), 'seasonal': (173, 866), 'blizzard': (1732, 86602)}
                 if slug == 'maitri' else
                 {'calm': (8.5, 25), 'ambient': (25, 140), 'seasonal': (220, 950), 'blizzard': (2000, 92000)})
        band = 'blizzard' if incident == 'BLIZZARD_ALERT' or wind >= 90 else 'ambient' if wind >= 5 else 'calm'
        low, high = bands[band]
        severity = min(1, max(0, (wind - 90) / 40)) if band == 'blizzard' else min(1, wind / 60)
        magnitude = round(min(high, max(low, low + (high-low) * (severity + random.uniform(-.025, .025)))), 1)
        weights = [random.uniform(.2, .5), random.uniform(.5, .9), random.uniform(.5, .9)]
        norm = math.sqrt(sum(v*v for v in weights))
        axes = dict(zip(('vertical', 'north_south', 'east_west'), [round(magnitude*v/norm, 3) for v in weights]))
        return magnitude, {'unit': 'nm/s²', 'axes': axes, 'magnitude': magnitude, 'band': band, 'bands': bands,
                           'source': 'User-provided prototype simulation envelopes; not measured station data'}

    # In-memory incident override state per station slug
    active_incidents = {
        'maitri': None,
        'bharati': None,
    }

    @classmethod
    def set_incident(cls, station_slug: str, incident_code: str):
        cls.active_incidents[station_slug] = incident_code

    @classmethod
    def clear_incident(cls, station_slug: str):
        cls.active_incidents[station_slug] = None

    @classmethod
    def tick(cls):
        """Runs one simulation step across all registered stations and updates database models."""
        stations = Station.objects.all()
        results = {}
        for station in stations:
            if station.slug == 'maitri':
                results['maitri'] = cls._simulate_maitri(station)
            elif station.slug == 'bharati':
                results['bharati'] = cls._simulate_bharati(station)
        return results

    @classmethod
    def _simulate_maitri(cls, station: Station):
        incident = cls.active_incidents.get('maitri')
        # Real live weather from Open-Meteo (or incident override)
        base_temp = -25.4
        base_wind = 12.2
        base_pressure = 972.6

        if incident == 'BLIZZARD_ALERT':
            ambient_temp = round(-36.5 + random.uniform(-0.8, 0.8), 1)
            wind_speed = round(98.4 + random.uniform(-2.5, 3.5), 1)
            surface_pressure = round(960.0 + random.uniform(-0.5, 0.5), 1)
        else:
            # Always return to real Open-Meteo baseline weather when nominal with natural katabatic wind fluctuations
            ambient_temp = round(base_temp + random.uniform(-0.3, 0.3), 1)
            wind_speed = round(base_wind + random.uniform(-1.8, 2.2), 1)
            surface_pressure = round(base_pressure + random.uniform(-0.2, 0.2), 1)

        # Maitri Diesel Generator Fuel Burn
        # Fuel burn increases with cold outdoor temp due to thermal efficiency and heating demands
        cold_factor = max(0.0, abs(ambient_temp - 0.0))
        base_burn = 22.0 + (cold_factor * 0.38) # Liters per hour
        fuel_burn_rate = round(base_burn + random.uniform(-0.5, 0.5), 2)
        
        # Power Generation (2 x 125 kVA Kirloskar/Cummins Gensets)
        gen1_kw = round(92.0 + random.uniform(-2.2, 2.2), 1)
        gen2_kw = round(88.0 + random.uniform(-2.2, 2.2), 1)
        total_power = round(gen1_kw + gen2_kw, 1)

        # Lake Priyadarshini Water Pipe Trace-Heating Loop
        # Pipeline is 2.5km long. Trace heating turns ON if ambient temp < -15°C
        trace_heater_on = (ambient_temp < -15.0) or (incident == 'LAKE_PIPE_FREEZE')
        if incident == 'LAKE_PIPE_FREEZE':
            # Heater failure or severe freeze scenario
            trace_heater_on = False
            pipe_water_temp = -2.4  # Freezing point
            water_flow_rate = 0.0   # Blocked
            trace_power_kw = 0.0
            pipe_status = "CRITICAL_FREEZE"
        else:
            trace_power_kw = 18.5 if trace_heater_on else 0.0
            pipe_water_temp = round(4.2 + (0.05 * ambient_temp) + random.uniform(-0.3, 0.3), 1)
            water_flow_rate = round(42.0 + random.uniform(-1.6, 1.6), 1) # L/min
            pipe_status = "ACTIVE_HEATED" if trace_heater_on else "STANDBY"

        # Fuel Reserves
        # Maitri has bulk storage tanks (A-depot, B-depot)
        fuel_reserve_days = round(162.0 - (fuel_burn_rate / 24.0 * 0.01), 1)

        # Indoor Habitation Module Comfort
        indoor_temp = round(20.4 + random.uniform(-0.3, 0.3), 1)

        # Structural Vibration during katabatic winds
        vibration_index, vibration = cls._triaxial_vibration('maitri', wind_speed, incident)

        # Battery Energy Storage System (BESS) - 150 kWh Station UPS Bank
        # Float charged in nominal ops (96-98%), provides peak buffer during high load or blizzard
        if incident == 'BLIZZARD_ALERT':
            battery_current = round(-35.0 + random.uniform(-3.5, 3.5), 1) # Peak shaving discharge
            battery_soc = round(88.5 + random.uniform(-0.4, 0.4), 1)
            battery_voltage = round(234.0 + random.uniform(-1.0, 1.0), 1)
            battery_autonomy = round(3.4 + random.uniform(-0.1, 0.1), 1)
        else:
            battery_current = round(6.5 + random.uniform(-1.0, 1.0), 1) # Trickle float charge
            battery_soc = round(97.4 + random.uniform(-0.3, 0.3), 1)
            battery_voltage = round(241.8 + random.uniform(-0.5, 0.5), 1)
            battery_autonomy = round(4.6 + random.uniform(-0.1, 0.1), 1)
        battery_temp = round(20.2 + random.uniform(-0.2, 0.2), 1)

        # Update Station Object
        station.weather_condition = 'Katabatic blizzard / exercise' if incident == 'BLIZZARD_ALERT' else ('Clear Sky / Polar Sun' if station.slug == 'maitri' else 'Overcast')
        station.ambient_temp = ambient_temp
        station.wind_speed = wind_speed
        station.surface_pressure = surface_pressure
        station.total_power_kw = total_power
        station.fuel_reserve_days = fuel_reserve_days
        station.primary_thermal_temp = pipe_water_temp
        station.trace_heating_active = trace_heater_on

        # Evaluate Alerts
        alerts = []
        status = 'NOMINAL'

        if incident == 'BLIZZARD_ALERT':
            status = 'EMERGENCY'
            alerts.append({
                'code': 'BLIZZARD_ALERT',
                'severity': 'EMERGENCY',
                'title': 'Severe Katabatic Blizzard Alert (>90 km/h)',
                'message': f'AWS recorded sustained katabatic wind gusts of {wind_speed} km/h with ambient temp {ambient_temp}°C.',
                'action': 'SOP: Station lockdown; switch outdoor trace heaters to emergency boost; isolate non-critical loads.'
            })
        elif wind_speed > 60:
            status = 'WARNING'
            alerts.append({
                'code': 'HIGH_WIND_WARNING',
                'severity': 'WARNING',
                'title': 'High Wind Velocity Detected',
                'message': f'Wind speeds exceeding 60 km/h ({wind_speed} km/h). External movement restricted.',
                'action': 'Secure communication radomes and Lake Priyadarshini inspection vehicle.'
            })

        if incident == 'LAKE_PIPE_FREEZE':
            status = 'CRITICAL'
            alerts.append({
                'code': 'LAKE_PIPE_FREEZE',
                'severity': 'CRITICAL',
                'title': 'Lake Priyadarshini Intake Line Freeze Threat',
                'message': f'Trace heating loop offline or insufficient. Water temp dropped to {pipe_water_temp}°C with zero flow.',
                'action': 'SOP: Engage auxiliary induction thawer; flush line with warm recirculation tank brine.'
            })

        station.operational_status = status
        station.active_alert_count = len(alerts)
        station.save(update_fields=['weather_condition', 'ambient_temp', 'wind_speed', 'surface_pressure', 'total_power_kw', 'fuel_reserve_days', 'primary_thermal_temp', 'trace_heating_active', 'operational_status', 'active_alert_count'])

        # Update Sensors & Subsystems in DB
        cls._persist_telemetry(station, {
            'GEN1_KW': gen1_kw,
            'GEN2_KW': gen2_kw,
            'TOTAL_POWER': total_power,
            'FUEL_BURN_RATE': fuel_burn_rate,
            'FUEL_RESERVES': fuel_reserve_days,
            'LAKE_PIPE_TEMP': pipe_water_temp,
            'LAKE_FLOW_RATE': water_flow_rate,
            'TRACE_HEATER_KW': trace_power_kw,
            'TRACE_HEATER_STATUS': 1.0 if trace_heater_on else 0.0,
            'INDOOR_TEMP': indoor_temp,
            'WIND_SPEED': wind_speed,
            'VIBRATION_INDEX': vibration_index,
            'BATTERY_SOC': battery_soc,
            'BATTERY_VOLTAGE': battery_voltage,
            'BATTERY_CURRENT': battery_current,
            'BATTERY_TEMP': battery_temp,
            'BATTERY_AUTONOMY': battery_autonomy,
        }, alerts)

        return {
            'station_slug': 'maitri',
            'status': status,
            'ambient_temp': ambient_temp,
            'wind_speed': wind_speed,
            'total_power_kw': total_power,
            'fuel_reserve_days': fuel_reserve_days,
            'primary_thermal_temp': pipe_water_temp,
            'trace_heating_active': trace_heater_on,
            'fuel_burn_rate': fuel_burn_rate,
            'indoor_temp': indoor_temp,
            'vibration_index': vibration_index,
            'triaxial_vibration': vibration,
            'pipe_status': pipe_status,
            'battery_soc': battery_soc,
            'battery_voltage': battery_voltage,
            'battery_current': battery_current,
            'battery_temp': battery_temp,
            'battery_autonomy': battery_autonomy,
            'incident': incident,
            'alerts': alerts,
        }

    @classmethod
    def _simulate_bharati(cls, station: Station):
        incident = cls.active_incidents.get('bharati')

        # Real live weather from Open-Meteo for Larsemann Hills (or incident override)
        base_temp = -12.4
        base_wind = 22.4
        base_pressure = 965.7

        if incident == 'BLIZZARD_ALERT':
            ambient_temp = round(-32.8 + random.uniform(-0.6, 0.6), 1)
            wind_speed = round(94.6 + random.uniform(-2.0, 3.0), 1)
            surface_pressure = round(955.0 + random.uniform(-0.4, 0.4), 1)
        else:
            # Always return to real Open-Meteo baseline weather when nominal with natural katabatic wind fluctuations
            ambient_temp = round(base_temp + random.uniform(-0.3, 0.3), 1)
            wind_speed = round(base_wind + random.uniform(-2.0, 2.5), 1)
            surface_pressure = round(base_pressure + random.uniform(-0.2, 0.2), 1)

        # Bharati 3 CHP Units (Combined Heat & Power, Scania/Leroy Somer)
        # Load sharing nominal: Gen 1 ~110 kW, Gen 2 ~105 kW, Gen 3 ~95 kW
        if incident == 'CHP_GEN2_TRIP':
            gen1_kw = round(158.0 + random.uniform(-1.5, 1.5), 1)
            gen2_kw = 0.0  # Tripped
            gen3_kw = round(152.0 + random.uniform(-1.5, 1.5), 1)
            gen2_state = "TRIPPED"
        else:
            gen1_kw = round(108.0 + random.uniform(-2.0, 2.0), 1)
            gen2_kw = round(104.0 + random.uniform(-2.0, 2.0), 1)
            gen3_kw = round(96.0 + random.uniform(-2.0, 2.0), 1)
            gen2_state = "NOMINAL"

        total_power = round(gen1_kw + gen2_kw + gen3_kw, 1)

        # 57% Glycol-L Hydronic Heating Loop (60°C nominal supply)
        if incident == 'GLYCOL_PRESSURE_DROP':
            glycol_pressure = round(0.85 + random.uniform(-0.05, 0.05), 2)  # Low pressure leak/cavitation
            glycol_supply_temp = round(44.2 + random.uniform(-0.8, 0.8), 1) # Plunging from 60°C
            glycol_return_temp = round(32.0 + random.uniform(-0.6, 0.6), 1)
            glycol_flow_rate = round(65.0 + random.uniform(-2.5, 2.5), 1)   # reduced
        else:
            glycol_pressure = round(3.05 + random.uniform(-0.06, 0.06), 2)  # 3.0-3.1 bar nominal
            glycol_supply_temp = round(60.2 + random.uniform(-0.6, 0.6), 1) # 60°C nominal
            glycol_return_temp = round(46.8 + random.uniform(-0.5, 0.5), 1)
            glycol_flow_rate = round(142.0 + random.uniform(-2.5, 2.5), 1)  # L/min

        # Fuel Storage & Depletion
        fuel_burn_rate = round(28.5 + (0.04 * (total_power - 300)) + random.uniform(-0.5, 0.5), 2) # L/h
        fuel_reserve_days = round(210.0 - (fuel_burn_rate / 24.0 * 0.01), 1)

        # Structural Aerodynamic Vibration (Bharati is raised on structural stilts)
        # Katabatic wind causes micro-oscillations on the stilted chassis
        vibration_index, vibration = cls._triaxial_vibration('bharati', wind_speed, incident)

        # Indoor Cabin Temperature
        indoor_temp = round(21.2 + random.uniform(-0.2, 0.2), 1)

        # Battery Energy Storage System (BESS) - 200 kWh Technical Deck Microgrid Inverter
        # Instantaneous handover and peak shaving buffer
        if incident == 'CHP_GEN2_TRIP':
            # Instantaneous BESS grid injection during CHP generator flameout/trip
            battery_current = round(-68.0 + random.uniform(-3.5, 3.5), 1) # Strong discharge injecting ~27 kW into microgrid
            battery_soc = round(84.6 + random.uniform(-0.4, 0.4), 1)
            battery_voltage = round(392.0 + random.uniform(-1.5, 1.5), 1)
            battery_autonomy = round(3.8 + random.uniform(-0.1, 0.1), 1)
        elif incident == 'BLIZZARD_ALERT':
            battery_current = round(-28.0 + random.uniform(-2.5, 2.5), 1) # Support heating & stilt damper loads
            battery_soc = round(92.0 + random.uniform(-0.3, 0.3), 1)
            battery_voltage = round(396.0 + random.uniform(-1.0, 1.0), 1)
            battery_autonomy = round(4.5 + random.uniform(-0.1, 0.1), 1)
        else:
            battery_current = round(10.5 + random.uniform(-1.2, 1.2), 1) # Normal float charge
            battery_soc = round(98.2 + random.uniform(-0.2, 0.2), 1)
            battery_voltage = round(401.8 + random.uniform(-0.8, 0.8), 1)
            battery_autonomy = round(5.2 + random.uniform(-0.1, 0.1), 1)
        battery_temp = round(21.0 + random.uniform(-0.2, 0.2), 1)

        # Update Station Model
        station.weather_condition = 'Katabatic blizzard / exercise' if incident == 'BLIZZARD_ALERT' else ('Clear Sky / Polar Sun' if station.slug == 'maitri' else 'Overcast')
        station.ambient_temp = ambient_temp
        station.wind_speed = wind_speed
        station.surface_pressure = surface_pressure
        station.total_power_kw = total_power
        station.fuel_reserve_days = fuel_reserve_days
        station.primary_thermal_temp = glycol_supply_temp
        station.trace_heating_active = True

        # Evaluate Alerts
        alerts = []
        status = 'NOMINAL'

        if incident == 'BLIZZARD_ALERT':
            status = 'EMERGENCY'
            alerts.append({
                'code': 'BLIZZARD_ALERT',
                'severity': 'EMERGENCY',
                'title': 'Severe Katabatic Gale / Structural Oscillation Alert',
                'message': f'Wind speeds peaked at {wind_speed} km/h. Structural stilt vibration at {vibration_index} nm/s².',
                'action': 'SOP: Restrict stilted underfloor access; engage damper stabilizers; seal external aerodynamic dampers.'
            })
        elif wind_speed > 60:
            status = 'WARNING'
            alerts.append({
                'code': 'HIGH_WIND_WARNING',
                'severity': 'WARNING',
                'title': 'High Katabatic Wind Alert',
                'message': f'Larsemann Hills katabatic wind stream at {wind_speed} km/h.',
                'action': 'Confirm stilt damper stability and lock outdoor helipad tie-downs.'
            })

        if incident == 'CHP_GEN2_TRIP':
            status = 'CRITICAL'
            alerts.append({
                'code': 'CHP_GEN2_TRIP',
                'severity': 'CRITICAL',
                'title': 'CHP Unit #2 Breaker Trip & Flameout',
                'message': f'CHP #2 offline (0 kW). BESS discharging {abs(battery_current)}A to maintain busbar frequency. CHP #1 ({gen1_kw} kW) and CHP #3 ({gen3_kw} kW) ramped up.',
                'action': 'SOP: Verify fuel manifold pressure; clear breaker lockout; execute remote automated restart sequence.'
            })

        if incident == 'GLYCOL_PRESSURE_DROP':
            status = 'CRITICAL'
            alerts.append({
                'code': 'GLYCOL_PRESSURE_DROP',
                'severity': 'CRITICAL',
                'title': '57% Glycol Hydronic Thermal Loop Low Pressure',
                'message': f'Loop pressure collapsed to {glycol_pressure} bar (< 1.5 bar threshold). Supply temp dropping to {glycol_supply_temp}°C.',
                'action': 'SOP: Switch to secondary circulation pump B; isolate zone manifold 3; replenish glycol reservoir.'
            })

        station.operational_status = status
        station.active_alert_count = len(alerts)
        station.save(update_fields=['weather_condition', 'ambient_temp', 'wind_speed', 'surface_pressure', 'total_power_kw', 'fuel_reserve_days', 'primary_thermal_temp', 'trace_heating_active', 'operational_status', 'active_alert_count'])

        # Persist Sensors & Subsystems
        cls._persist_telemetry(station, {
            'CHP1_KW': gen1_kw,
            'CHP2_KW': gen2_kw,
            'CHP3_KW': gen3_kw,
            'TOTAL_POWER': total_power,
            'GLYCOL_SUPPLY_TEMP': glycol_supply_temp,
            'GLYCOL_RETURN_TEMP': glycol_return_temp,
            'GLYCOL_PRESSURE': glycol_pressure,
            'GLYCOL_FLOW_RATE': glycol_flow_rate,
            'FUEL_BURN_RATE': fuel_burn_rate,
            'FUEL_RESERVES': fuel_reserve_days,
            'INDOOR_TEMP': indoor_temp,
            'WIND_SPEED': wind_speed,
            'VIBRATION_INDEX': vibration_index,
            'BATTERY_SOC': battery_soc,
            'BATTERY_VOLTAGE': battery_voltage,
            'BATTERY_CURRENT': battery_current,
            'BATTERY_TEMP': battery_temp,
            'BATTERY_AUTONOMY': battery_autonomy,
        }, alerts)

        return {
            'station_slug': 'bharati',
            'status': status,
            'ambient_temp': ambient_temp,
            'wind_speed': wind_speed,
            'total_power_kw': total_power,
            'fuel_reserve_days': fuel_reserve_days,
            'primary_thermal_temp': glycol_supply_temp,
            'glycol_return_temp': glycol_return_temp,
            'glycol_pressure': glycol_pressure,
            'chp1_kw': gen1_kw,
            'chp2_kw': gen2_kw,
            'chp3_kw': gen3_kw,
            'gen2_state': gen2_state,
            'fuel_burn_rate': fuel_burn_rate,
            'indoor_temp': indoor_temp,
            'vibration_index': vibration_index,
            'triaxial_vibration': vibration,
            'battery_soc': battery_soc,
            'battery_voltage': battery_voltage,
            'battery_current': battery_current,
            'battery_temp': battery_temp,
            'battery_autonomy': battery_autonomy,
            'incident': incident,
            'alerts': alerts,
        }

    _tick_counter = 0

    @classmethod
    def _persist_telemetry(cls, station: Station, metrics: dict, active_alerts: list):
        """Updates Sensor current values and saves SensorReading records using bulk operations."""
        from django.db import transaction
        now = timezone.now()

        with transaction.atomic():
            # 1. Bulk fetch all matching sensors in ONE query
            sensors = list(Sensor.objects.filter(station=station, sensor_code__in=list(metrics.keys())))
            sensor_map = {s.sensor_code: s for s in sensors}

            sensors_to_update = []
            readings_to_create = []

            for code, val in metrics.items():
                sensor = sensor_map.get(code)
                if not sensor:
                    continue
                sensor.current_value = val
                is_anomaly = False
                if sensor.safe_min is not None and val < sensor.safe_min:
                    is_anomaly = True
                if sensor.safe_max is not None and val > sensor.safe_max:
                    is_anomaly = True
                failed_sensors = {
                    'LAKE_PIPE_FREEZE': {'TRACE_HEATER_KW', 'TRACE_HEATER_STATUS'},
                    'CHP_GEN2_TRIP': {'CHP2_KW'},
                }
                is_anomaly = is_anomaly or code in failed_sensors.get(cls.active_incidents.get(station.slug), set())
                sensor.is_anomaly = is_anomaly
                sensors_to_update.append(sensor)
                readings_to_create.append(
                    SensorReading(sensor=sensor, timestamp=now, value=val, is_anomaly=is_anomaly, metadata={'unit': sensor.unit, 'source': 'simulator'})
                )

            # 2. Bulk update all sensors in ONE query
            if sensors_to_update:
                Sensor.objects.bulk_update(sensors_to_update, ['current_value', 'is_anomaly'])

            # Nominal recovery clears previous subsystem warnings as well as sensor flags.
            affected = {
                'BLIZZARD_ALERT': {'WEATHER', 'STRUCTURAL_HEALTH', 'BATTERY_STORAGE'},
                'LAKE_PIPE_FREEZE': {'WATER_INTAKE'},
                'CHP_GEN2_TRIP': {'POWER_CHP', 'BATTERY_STORAGE'},
                'GLYCOL_PRESSURE_DROP': {'HVAC_GLYCOL'},
            }.get(cls.active_incidents.get(station.slug), set())
            anomalous_subsystems = set(Sensor.objects.filter(station=station, is_anomaly=True).values_list('subsystem_id', flat=True))
            systems = list(Subsystem.objects.filter(station=station))
            for system in systems:
                system.status = 'CRITICAL' if system.code in affected or system.id in anomalous_subsystems else 'NOMINAL'
            Subsystem.objects.bulk_update(systems, ['status'])

            # 3. Bulk create all readings in ONE query
            if readings_to_create:
                SensorReading.objects.bulk_create(readings_to_create)

            # 4. Update or create StationAlert entries
            active_codes = [a['code'] for a in active_alerts]
            StationAlert.objects.filter(station=station, is_active=True).exclude(
                incident_code__in=active_codes
            ).update(is_active=False, resolved_at=now)

            for a in active_alerts:
                alert, created = StationAlert.objects.get_or_create(
                    station=station,
                    incident_code=a['code'],
                    is_active=True,
                    defaults={
                        'severity': a['severity'],
                        'title': a['title'],
                        'message': a['message'],
                        'recommended_action': a['action'],
                        'created_at': now,
                    }
                )
                if not created:
                    alert.message = a['message']
                    alert.recommended_action = a['action']
                    alert.save(update_fields=['message', 'recommended_action'])

        # 5. Periodic cleanup: every 100 ticks, trim old readings for ALL sensors
        cls._tick_counter += 1
        if cls._tick_counter >= 100:
            cls._tick_counter = 0
            try:
                for sensor in station.sensors.all():
                    count = sensor.readings.count()
                    if count > 500:
                        cutoff_ids = list(
                            sensor.readings.order_by('-timestamp').values_list('id', flat=True)[400:]
                        )
                        if cutoff_ids:
                            SensorReading.objects.filter(id__in=cutoff_ids).delete()
            except Exception:
                pass  # Non-critical maintenance task
