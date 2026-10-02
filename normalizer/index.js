// Normaliseur : écoute les uplinks bruts, les décode, les valide et publie l'enveloppe normalisée.
// Tout message invalide part en dead-letter (DLQ), sans jamais faire tomber le service.
const mqtt = require('mqtt');
const { createClient } = require('redis');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const decoders = require('./decoders');
const { UNITS } = require('./catalogue');

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MAX_FUTURE_S = 300;          // on refuse un horodatage à plus de 5 min dans le futur

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);                   // active les formats comme "date-time"
const validateUplink = ajv.compile(require('./schema/uplink.schema.json'));
const validateEnvelope = ajv.compile(require('./schema/envelope.schema.json'));

// Une erreur "métier" qui porte la raison du rejet
class Rejected extends Error {
  constructor(reason, detail) { super(detail); this.reason = reason; }
}

async function main() {
  const redis = createClient({ url: REDIS_URL });
  redis.on('error', (e) => console.error('[redis]', e.message));
  await redis.connect();

  const client = mqtt.connect(MQTT_URL, { clientId: 'normalizer', reconnectPeriod: 3000 });

  client.on('connect', () => {
    client.subscribe('bms/+/gw/+/up', { qos: 1 });
    console.log(`[norm] connecté à ${MQTT_URL}, abonné à bms/+/gw/+/up`);
  });
  client.on('error', (e) => console.error('[mqtt]', e.message));

  client.on('message', async (topic, payloadBuf) => {
    const [, tenant, , gatewayId] = topic.split('/');
    const raw = payloadBuf.toString();
    try {
      const envelope = await normalize(redis, tenant, gatewayId, raw);
      client.publish(`bms/${tenant}/norm/telemetry`, JSON.stringify(envelope), { qos: 1 });
      console.log(`[norm] OK ${envelope.dev_eui} ${envelope.model} fCnt=${envelope.f_cnt}`);
    } catch (err) {
      // Toute erreur, prévue ou non, finit en dead-letter : le service continue
      const reason = err instanceof Rejected ? err.reason : 'internal_error';
      const dl = { reason, detail: err.message, topic, raw, received_at: new Date().toISOString() };
      client.publish(`bms/${tenant}/dlq`, JSON.stringify(dl), { qos: 1 });
      console.warn(`[norm] DLQ ${reason}: ${err.message}`);
    }
  });
}

async function normalize(redis, tenant, gatewayId, raw) {
  // 1. Est-ce du JSON ?
  let up;
  try { up = JSON.parse(raw); } catch { throw new Rejected('invalid_json', 'payload non JSON'); }

  // 2. Respecte-t-il le contrat d'entrée ?
  if (!validateUplink(up)) throw new Rejected('schema_error', ajv.errorsText(validateUplink.errors));

  // 3. Le capteur est-il enregistré, et chez ce tenant ?
  const devEui = up.devEui.toUpperCase();
  const cached = await redis.get(`device:${devEui}`);
  if (!cached) throw new Rejected('unknown_device', `${devEui} non onboardé`);
  const device = JSON.parse(cached);
  if (device.tenant !== tenant) throw new Rejected('tenant_mismatch', `${devEui} n'appartient pas à ${tenant}`);

  // 4. L'horodatage est-il plausible ?
  const skew = (Date.parse(up.time) - Date.now()) / 1000;
  if (skew > MAX_FUTURE_S) throw new Rejected('clock_skew', `horodatage ${Math.round(skew)} s dans le futur`);

  // 5. Décodage des octets avec le décodeur du modèle
  const decode = decoders[device.model];
  if (!decode) throw new Rejected('no_decoder', `pas de décodeur pour ${device.model}`);
  const bytes = [...Buffer.from(up.data, 'base64')];
  let values;
  try { values = decode(bytes, up.fPort); } catch (e) { throw new Rejected('decode_error', e.message); }

  // 6. Construction de l'enveloppe commune
  const rx = up.rxInfo[0];
  const envelope = {
    schema_version: 1,
    tenant,
    dev_eui: devEui,
    model: device.model,
    ts: up.time,
    f_cnt: up.fCnt,
    gateway_id: gatewayId,
    rssi: rx.rssi,
    snr: rx.snr,
    metrics: Object.entries(values).map(([code, value]) => ({ code, value, unit: UNITS[code] ?? null })),
  };

  // 7. Ce que l'on émet respecte-t-il le contrat de sortie ?
  if (!validateEnvelope(envelope)) throw new Rejected('envelope_error', ajv.errorsText(validateEnvelope.errors));
  return envelope;
}

main().catch((e) => { console.error(e); process.exit(1); });