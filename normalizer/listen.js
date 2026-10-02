const mqtt = require('mqtt');                                  // importe la bibliothèque
const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {                                   // "quand la connexion est établie, fais ceci"
  client.subscribe('bms/+/gw/+/up');
  console.log('abonné');
});

client.on('message', (topic, payloadBuf) => {                  // appelé à chaque message reçu
  const up = JSON.parse(payloadBuf.toString());
  const bytes = [...Buffer.from(up.data, 'base64')];           // base64 -> tableau d'entiers 0..255
  console.log(topic, up.devEui, 'fCnt', up.fCnt, 'octets', bytes);
});