// Même signature que les décodeurs Dragino pour TTN / ChirpStack : Decoder(bytes, port) -> valeurs
function decodeS31(bytes, port) {
  if (bytes.length !== 6) throw new Error(`S31: 6 octets attendus, reçu ${bytes.length}`);

  const batteryMv = (bytes[0] << 8) | bytes[1];

  let temp = (bytes[2] << 8) | bytes[3];
  if (temp & 0x8000) temp -= 0x10000;           // nombre négatif

  const hum = (bytes[4] << 8) | bytes[5];

  return {
    battery_v: batteryMv / 1000,
    temperature_c: temp / 10,
    humidity_pct: hum / 10,
  };
}
module.exports = decodeS31;