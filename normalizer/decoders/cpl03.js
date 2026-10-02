function decodeCPL03(bytes, port) {
  if (bytes.length !== 6) throw new Error(`CPL03: 6 octets attendus, reçu ${bytes.length}`);

  const flags = bytes[0];
  return {
    contact_state: flags & 0x01,                                        // bit 0
    device_fault: (flags >> 1) & 0x01,                                  // bit 1
    open_count_total: (bytes[1] << 16) | (bytes[2] << 8) | bytes[3],    // 3 octets
    battery_v: ((bytes[4] << 8) | bytes[5]) / 1000,
  };
}
module.exports = decodeCPL03;