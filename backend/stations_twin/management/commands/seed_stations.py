from django.core.management.base import BaseCommand
from django.utils import timezone
from stations_twin.models import Station, Subsystem, Sensor, SensorReading, StationAlert

class Command(BaseCommand):
    help = 'Seeds initial station data, subsystems, sensors, and baseline readings for Maitri and Bharati.'

    def handle(self, *args, **options):
        self.stdout.write("Seeding Antarctic Research Stations...")

        # 1. MAITRI STATION
        maitri, created = Station.objects.update_or_create(
            slug='maitri',
            defaults={
                'name': 'Maitri Research Station',
                'latitude': -70.7658,
                'longitude': 11.7358,
                'elevation': 117.0,
                'location_name': 'Schirmacher Oasis, Queen Maud Land',
                'operational_status': 'NOMINAL',
                'commissioning_year': 1989,
                'active_crew_count': 25,
                'description': (
                    "India's second permanent research station in Antarctica. Built on rocky oasis terrain with "
                    "a double-block containerized structure, supplied with freshwater via a 2.5 km electrically "
                    "trace-heated surface pipeline from Lake Priyadarshini."
                ),
                'ambient_temp': -18.2,
                'wind_speed': 34.0,
                'wind_direction': 120.0,
                'surface_pressure': 984.0,
                'solar_radiation': 15.0,
                'weather_condition': 'Drifting Snow / Clear Ice',
                'total_power_kw': 180.0,
                'fuel_reserve_days': 165.0,
                'primary_thermal_temp': 4.2,
                'active_alert_count': 0,
                'trace_heating_active': True,
            }
        )
        self.stdout.write(f"Station: {maitri.name} configured.")

        # Maitri Subsystems
        m_power, _ = Subsystem.objects.update_or_create(
            station=maitri, code='POWER_CHP',
            defaults={
                'name': 'Diesel Generator Power Plant (2x 125 kVA)',
                'status': 'NOMINAL',
                'description': 'Primary electrical microgrid powered by heavy-duty diesel engines with exhaust heat exchangers.',
                'telemetry_metadata': {'active_units': [1, 2], 'grid_hz': 50.02, 'voltage_v': 415.0}
            }
        )
        m_fuel, _ = Subsystem.objects.update_or_create(
            station=maitri, code='FUEL_STORAGE',
            defaults={
                'name': 'Fuel Storage Depot & Day Tanks',
                'status': 'NOMINAL',
                'description': 'Aviation-grade Jet A-1 / Arctic Diesel tanks with internal thermal heating pads.',
                'telemetry_metadata': {'total_capacity_liters': 180000, 'current_liters': 122400}
            }
        )
        m_water, _ = Subsystem.objects.update_or_create(
            station=maitri, code='WATER_INTAKE',
            defaults={
                'name': 'Lake Priyadarshini Heated Trace Pipeline',
                'status': 'NOMINAL',
                'description': '2.5 km surface intake pipeline with dual-redundant self-regulating heat trace cables.',
                'telemetry_metadata': {'loop_length_m': 2500, 'trace_wattage_pm': 35}
            }
        )
        m_struct, _ = Subsystem.objects.update_or_create(
            station=maitri, code='STRUCTURAL_HEALTH',
            defaults={
                'name': 'Double-Block Habitation Module Frame',
                'status': 'NOMINAL',
                'description': 'Main containerized living, laboratory, and communication radome structural ties.',
                'telemetry_metadata': {'anchor_tension_kn': 48.5, 'radome_pressure_pa': 1012}
            }
        )
        m_weather, _ = Subsystem.objects.update_or_create(
            station=maitri, code='WEATHER',
            defaults={
                'name': 'Schirmacher Oasis Automated Met Station',
                'status': 'NOMINAL',
                'description': 'Continuous surface meteorological sensors and pyranometer suite.',
                'telemetry_metadata': {'met_mast_height_m': 10.0}
            }
        )
        m_bess, _ = Subsystem.objects.update_or_create(
            station=maitri, code='BATTERY_STORAGE',
            defaults={
                'name': 'Emergency Central BESS & Station UPS Bank',
                'status': 'NOMINAL',
                'description': 'Containerized 150 kWh Deep-Cycle VRLA/LiFePO4 battery storage array providing seamless black-start, microgrid voltage regulation, and life-support buffer.',
                'telemetry_metadata': {
                    'chemistry': 'Deep-Cycle VRLA / Containerized LiFePO4',
                    'nominal_capacity_kwh': 150.0,
                    'rated_voltage_vdc': 240.0,
                    'backup_autonomy_hrs': 4.5,
                    'ups_topology': 'Online Double-Conversion N+1'
                }
            }
        )

        # Maitri Sensors
        maitri_sensors = [
            (m_power, 'GEN1_KW', 'Generator #1 Output', 'kw_output', 'kW', 0.0, 130.0, 92.0),
            (m_power, 'GEN2_KW', 'Generator #2 Output', 'kw_output', 'kW', 0.0, 130.0, 88.0),
            (m_power, 'TOTAL_POWER', 'Total Station Power Output', 'kw_output', 'kW', 80.0, 250.0, 180.0),
            (m_fuel, 'FUEL_BURN_RATE', 'Aggregate Fuel Burn Rate', 'fuel_flow', 'L/h', 15.0, 45.0, 24.2),
            (m_fuel, 'FUEL_RESERVES', 'Fuel Reserves Autonomy', 'level', 'Days', 30.0, 365.0, 165.0),
            (m_water, 'LAKE_PIPE_TEMP', 'Priyadarshini Pipeline Water Temp', 'temp', '°C', 1.0, 25.0, 4.2),
            (m_water, 'LAKE_FLOW_RATE', 'Lake Water Intake Flow', 'flow_rate', 'L/min', 10.0, 80.0, 42.0),
            (m_water, 'TRACE_HEATER_KW', 'Trace Heating Power Demand', 'kw_output', 'kW', 0.0, 35.0, 18.5),
            (m_water, 'TRACE_HEATER_STATUS', 'Trace Heater Relay (0=Off, 1=On)', 'status_flag', 'state', 0.0, 1.0, 1.0),
            (m_struct, 'INDOOR_TEMP', 'Habitation Module Ambient Temp', 'temp', '°C', 18.0, 24.0, 20.4),
            (m_struct, 'VIBRATION_INDEX', 'Triaxial Vibration (RSS)', 'vibration', 'nm/s²', 7.1, 115.0, 65.0),
            (m_weather, 'WIND_SPEED', 'AWS Anemometer Wind Velocity', 'wind_speed', 'km/h', 0.0, 60.0, 34.0),
            (m_bess, 'BATTERY_SOC', 'BESS State of Charge', 'level', '%', 35.0, 100.0, 97.4),
            (m_bess, 'BATTERY_VOLTAGE', 'DC Bus Voltage', 'pressure', 'V DC', 220.0, 260.0, 241.8),
            (m_bess, 'BATTERY_CURRENT', 'Net Battery Current Flow', 'flow_rate', 'A', -80.0, 60.0, 8.2),
            (m_bess, 'BATTERY_TEMP', 'Thermal Enclosure Temperature', 'temp', '°C', 10.0, 28.0, 20.2),
            (m_bess, 'BATTERY_AUTONOMY', 'Estimated Backup Autonomy', 'flow_rate', 'Hours', 1.0, 12.0, 4.6),
        ]

        for sub, code, name, m_type, unit, s_min, s_max, val in maitri_sensors:
            s, _ = Sensor.objects.update_or_create(
                station=maitri, sensor_code=code,
                defaults={
                    'subsystem': sub,
                    'name': name,
                    'metric_type': m_type,
                    'unit': unit,
                    'safe_min': s_min,
                    'safe_max': s_max,
                    'current_value': val,
                    'is_anomaly': False,
                }
            )
            # Create baseline readings
            if not s.readings.exists():
                for offset in range(10, 0, -1):
                    SensorReading.objects.create(
                        sensor=s,
                        value=val,
                        timestamp=timezone.now() - timezone.timedelta(seconds=offset * 30)
                    )

        # 2. BHARATI STATION
        bharati, created = Station.objects.update_or_create(
            slug='bharati',
            defaults={
                'name': 'Bharati Research Station',
                'latitude': -69.4078,
                'longitude': 76.1872,
                'elevation': 35.0,
                'location_name': 'Larsemann Hills, East Antarctica',
                'operational_status': 'NOMINAL',
                'commissioning_year': 2012,
                'active_crew_count': 47,
                'description': (
                    "India's state-of-the-art third Antarctic station. An elevated aerodynamic module built from "
                    "interlinked prefabricated shipping containers on structural stilts to shed katabatic snowdrifts, "
                    "featuring a 57% Glycol hydronic thermal loop and tri-generation CHP microgrid."
                ),
                'ambient_temp': -16.0,
                'wind_speed': 28.5,
                'wind_direction': 105.0,
                'surface_pressure': 988.0,
                'solar_radiation': 22.0,
                'weather_condition': 'Clear Ice / Steady Polar Breeze',
                'total_power_kw': 308.0,
                'fuel_reserve_days': 210.0,
                'primary_thermal_temp': 60.2,
                'active_alert_count': 0,
                'trace_heating_active': True,
            }
        )
        self.stdout.write(f"Station: {bharati.name} configured.")

        # Bharati Subsystems
        b_power, _ = Subsystem.objects.update_or_create(
            station=bharati, code='POWER_CHP',
            defaults={
                'name': 'Tri-Generation CHP Microgrid (3x Scania)',
                'status': 'NOMINAL',
                'description': 'Combined Heat and Power units recovering exhaust heat directly into building heating circuits.',
                'telemetry_metadata': {'active_units': [1, 2, 3], 'grid_hz': 50.0, 'busbar_voltage_v': 400.0}
            }
        )
        b_glycol, _ = Subsystem.objects.update_or_create(
            station=bharati, code='HVAC_GLYCOL',
            defaults={
                'name': '57% Glycol Hydronic Heating Loop',
                'status': 'NOMINAL',
                'description': 'Low-viscosity anti-freeze primary thermal loop distributing 60°C nominal heat to air handling units.',
                'telemetry_metadata': {'concentration_percent': 57.0, 'nominal_supply_c': 60.0, 'expansion_tank_bar': 3.1}
            }
        )
        b_fuel, _ = Subsystem.objects.update_or_create(
            station=bharati, code='FUEL_STORAGE',
            defaults={
                'name': 'Double-Wall Arctic Fuel Storage Complex',
                'status': 'NOMINAL',
                'description': 'Multi-compartment storage with leak detection and heated suction lines.',
                'telemetry_metadata': {'storage_tanks': 6, 'capacity_liters': 320000}
            }
        )
        b_struct, _ = Subsystem.objects.update_or_create(
            station=bharati, code='STRUCTURAL_HEALTH',
            defaults={
                'name': 'Elevated Aerodynamic Stilt Chassis',
                'status': 'NOMINAL',
                'description': 'Variable dampening structural stilts with katabatic vibration monitoring arrays.',
                'telemetry_metadata': {'stilt_count': 18, 'clearance_height_m': 3.5}
            }
        )
        b_weather, _ = Subsystem.objects.update_or_create(
            station=bharati, code='WEATHER',
            defaults={
                'name': 'Larsemann Hills Automated Weather Station',
                'status': 'NOMINAL',
                'description': 'High-latitude sonic anemometer and ice accumulation detectors.',
                'telemetry_metadata': {'station_type': 'Vaisala Mil-Spec AWS'}
            }
        )
        b_bess, _ = Subsystem.objects.update_or_create(
            station=bharati, code='BATTERY_STORAGE',
            defaults={
                'name': 'Technical Deck Microgrid BESS & Central UPS',
                'status': 'NOMINAL',
                'description': 'Industrial 200 kWh Lithium Iron Phosphate (LiFePO4) energy storage and dual 60 kVA online UPS modules integrated into the lower technical stilt container chassis.',
                'telemetry_metadata': {
                    'chemistry': 'Industrial LiFePO4 (LFP)',
                    'nominal_capacity_kwh': 200.0,
                    'rated_voltage_vdc': 400.0,
                    'backup_autonomy_hrs': 5.2,
                    'ups_topology': 'Dual-Parallel Redundant 60 kVA Static Inverters'
                }
            }
        )

        # Bharati Sensors
        bharati_sensors = [
            (b_power, 'CHP1_KW', 'CHP Generator #1 Electric Output', 'kw_output', 'kW', 0.0, 160.0, 108.0),
            (b_power, 'CHP2_KW', 'CHP Generator #2 Electric Output', 'kw_output', 'kW', 0.0, 160.0, 104.0),
            (b_power, 'CHP3_KW', 'CHP Generator #3 Electric Output', 'kw_output', 'kW', 0.0, 160.0, 96.0),
            (b_power, 'TOTAL_POWER', 'Combined Tri-Gen Power', 'kw_output', 'kW', 150.0, 420.0, 308.0),
            (b_glycol, 'GLYCOL_SUPPLY_TEMP', 'Hydronic Glycol Supply Temp', 'temp', '°C', 50.0, 75.0, 60.2),
            (b_glycol, 'GLYCOL_RETURN_TEMP', 'Hydronic Glycol Return Temp', 'temp', '°C', 35.0, 55.0, 46.8),
            (b_glycol, 'GLYCOL_PRESSURE', 'Glycol Primary Loop Pressure', 'pressure', 'bar', 1.8, 4.5, 3.05),
            (b_glycol, 'GLYCOL_FLOW_RATE', 'Circulation Pump Flow Rate', 'flow_rate', 'L/min', 80.0, 200.0, 142.0),
            (b_fuel, 'FUEL_BURN_RATE', 'Tri-Gen Total Fuel Burn', 'fuel_flow', 'L/h', 20.0, 60.0, 28.5),
            (b_fuel, 'FUEL_RESERVES', 'Fuel Reserves Autonomy', 'level', 'Days', 40.0, 365.0, 210.0),
            (b_struct, 'INDOOR_TEMP', 'Habitation Deck Air Temp', 'temp', '°C', 19.0, 23.5, 21.2),
            (b_struct, 'VIBRATION_INDEX', 'Triaxial Vibration (RSS)', 'vibration', 'nm/s²', 8.5, 140.0, 80.0),
            (b_weather, 'WIND_SPEED', 'AWS Anemometer Wind Velocity', 'wind_speed', 'km/h', 0.0, 60.0, 28.5),
            (b_bess, 'BATTERY_SOC', 'Microgrid BESS State of Charge', 'level', '%', 40.0, 100.0, 98.2),
            (b_bess, 'BATTERY_VOLTAGE', 'DC Busbar Float Voltage', 'pressure', 'V DC', 380.0, 425.0, 401.5),
            (b_bess, 'BATTERY_CURRENT', 'Net BESS Inverter Current', 'flow_rate', 'A', -120.0, 80.0, 12.5),
            (b_bess, 'BATTERY_TEMP', 'BESS Thermal Container Temp', 'temp', '°C', 15.0, 26.0, 21.0),
            (b_bess, 'BATTERY_AUTONOMY', 'Critical Load Backup Autonomy', 'flow_rate', 'Hours', 1.5, 15.0, 5.2),
        ]

        for sub, code, name, m_type, unit, s_min, s_max, val in bharati_sensors:
            s, _ = Sensor.objects.update_or_create(
                station=bharati, sensor_code=code,
                defaults={
                    'subsystem': sub,
                    'name': name,
                    'metric_type': m_type,
                    'unit': unit,
                    'safe_min': s_min,
                    'safe_max': s_max,
                    'current_value': val,
                    'is_anomaly': False,
                }
            )
            if not s.readings.exists():
                for offset in range(10, 0, -1):
                    SensorReading.objects.create(
                        sensor=s,
                        value=val,
                        timestamp=timezone.now() - timezone.timedelta(seconds=offset * 30)
                    )

        self.stdout.write(self.style.SUCCESS("Successfully seeded all Antarctic stations, subsystems, and sensors!"))
