function decodePF52(bytes, port) {
  if (bytes.length !== 7) throw new Error(`PF52: 7 octets attendus, reçu ${bytes.length}`);

  return {
    people_in_total: (bytes[0] << 8) | bytes[1],
    people_out_total: (bytes[2] << 8) | bytes[3],
    device_fault: bytes[4] ? 1 : 0,
    battery_v: ((bytes[5] << 8) | bytes[6]) / 1000,
  };
}
module.exports = decodePF52;