const mqtt = require('mqtt');
const decoders = require('./decoders');
const { UNITS } = require('./catalogue');

// PROVISOIRE : quel modèle pour quel capteur ? (remplacé par Redis en 3.10)
const DEVICE_MODELS = { A84041000000A001: 'S31', A84041000000A002: 'CPL03', A84041000000A003: 'PF52' };

const client = mqtt.connect(process.env.MQTT_URL || 'mqtt://localhost:1883', { clientId: 'normalizer' });

client.on('connect', () => {
  client.subscribe('bms/+/gw/+/up', { qos: 1 });
  console.log('[norm] prêt');
});

client.on('message', (topic, payloadBuf) => {
  const [, tenant, , gatewayId] = topic.split('/');      // "bms/ascencia/gw/dlos8n-01/up" -> morceaux
  const up = JSON.parse(payloadBuf.toString());
  const model = DEVICE_MODELS[up.devEui];
  const values = decoders[model]([...Buffer.from(up.data, 'base64')], up.fPort);

  const envelope = {
    schema_version: 1,
    tenant,
    dev_eui: up.devEui,
    model,
    ts: up.time,
    f_cnt: up.fCnt,
    gateway_id: gatewayId,
    rssi: up.rxInfo[0].rssi,
    snr: up.rxInfo[0].snr,
    // { temperature_c: 27.8, ... } -> [ { code: 'temperature_c', value: 27.8, unit: '°C' }, ... ]
    metrics: Object.entries(values).map(([code, value]) => ({ code, value, unit: UNITS[code] ?? null })),
  };
  client.publish(`bms/${tenant}/norm/telemetry`, JSON.stringify(envelope), { qos: 1 });
  console.log(`[norm] ${up.devEui} ${model}`, values);
});