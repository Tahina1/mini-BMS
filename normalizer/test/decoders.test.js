const test = require('node:test');          // lanceur de tests intégré à Node (pas de bibliothèque à installer)
const assert = require('node:assert');
const d = require('../decoders');

const hex = (s) => [...Buffer.from(s, 'hex')];    // "0E10" -> [14, 16]

test('S31 : température positive', () => {
  // 0E10 = 3600 mV | 011A = 282 -> 28.2 °C | 0258 = 600 -> 60.0 %
  assert.deepStrictEqual(d.S31(hex('0E10011A0258'), 2), { battery_v: 3.6, temperature_c: 28.2, humidity_pct: 60 });
});

test('S31 : température négative (complément à 2)', () => {
  assert.strictEqual(d.S31(hex('0E10FF9C0258'), 2).temperature_c, -10);
});

test('S31 : trame trop courte rejetée', () => {
  assert.throws(() => d.S31(hex('0102'), 2), /6 octets/);
});

test('CPL03 : contact fermé + défaut', () => {
  // 03 = bits 0 et 1 à 1 | 000005 = 5 ouvertures | 0DAC = 3500 mV
  assert.deepStrictEqual(d.CPL03(hex('030000050DAC'), 2), {
    contact_state: 1, device_fault: 1, open_count_total: 5, battery_v: 3.5,
  });
});

test('PF52 : compteurs', () => {
  assert.deepStrictEqual(d.PF52(hex('00640050000E10'), 2), {
    people_in_total: 100, people_out_total: 80, device_fault: 0, battery_v: 3.6,
  });
});