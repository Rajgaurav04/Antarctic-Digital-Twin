from django.db import migrations


def update_envelopes(apps, schema_editor):
    Sensor = apps.get_model('stations_twin', 'Sensor')
    Reading = apps.get_model('stations_twin', 'SensorReading')
    for slug, low, high, baseline in [('maitri', 7.1, 115, 65), ('bharati', 8.5, 140, 80)]:
        for sensor in Sensor.objects.filter(station__slug=slug, sensor_code='VIBRATION_INDEX'):
            # Preserve old readings and their original unit instead of relabelling history.
            for reading in Reading.objects.filter(sensor=sensor).iterator():
                metadata = dict(reading.metadata or {})
                metadata.setdefault('unit', sensor.unit)
                metadata.setdefault('source', 'legacy vibration simulator')
                Reading.objects.filter(pk=reading.pk).update(metadata=metadata)
            Sensor.objects.filter(pk=sensor.pk).update(name='Triaxial Vibration (RSS)', unit='nm/s²', safe_min=low, safe_max=high, current_value=baseline, is_anomaly=False)
    Sensor.objects.filter(sensor_code='WIND_SPEED').update(safe_max=60)


class Migration(migrations.Migration):
    dependencies = [('stations_twin', '0002_alter_subsystem_code')]
    operations = [migrations.RunPython(update_envelopes, migrations.RunPython.noop)]
