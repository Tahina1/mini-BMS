"""
Capteurs simulés. Chaque classe produit des OCTETS, comme un vrai capteur LoRaWAN.
Formats INSPIRÉS de Dragino mais simplifiés : les vrais sont dans les manuels Dragino.
"""
import random
import struct


class Device:
    model = "?"
    f_port = 2

    def __init__(self, dev_eui: str, name: str, interval_s: int):
        self.dev_eui = dev_eui
        self.name = name
        self.interval_s = interval_s
        self.f_cnt = 0
        self.battery_mv = random.randint(3500, 3650)
        self.silent = False           # True = le capteur n'émet plus
        self.fault = False
        self.clock_offset_s = 0       # décalage d'horloge simulé

    def next_f_cnt(self) -> int:
        self.f_cnt += 1
        return self.f_cnt

    def step(self):
        """Fait évoluer l'état physique entre deux mesures."""
        if random.random() < 0.05:
            self.battery_mv -= 1      # la pile s'use lentement

    def encode(self) -> bytes:
        raise NotImplementedError     # chaque modèle définit son propre format


class S31(Device):
    """Température / humidité. 6 octets :
    [0-1] batterie mV (uint16)  [2-3] température x10 (int16 SIGNÉ)  [4-5] humidité x10 (uint16)
    """
    model = "S31"

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)    # exécute d'abord le __init__ de Device
        self.temp_c = 28.0
        self.hum_pct = 60.0
        self.heating = False

    def step(self):
        super().step()
        if self.heating:
            self.temp_c = min(self.temp_c + 1.5, 45.0)
        elif self.temp_c > 29:
            self.temp_c -= 1.0                       # refroidit après une surchauffe
        else:
            self.temp_c += random.uniform(-0.3, 0.3)
        self.hum_pct = max(20, min(90, self.hum_pct + random.uniform(-1, 1)))

    def encode(self) -> bytes:
        return struct.pack(">HhH", self.battery_mv, round(self.temp_c * 10), round(self.hum_pct * 10))


class CPL03(Device):
    """Contact sec. 6 octets :
    [0] flags : bit0 = contact fermé, bit1 = défaut   [1-3] compteur d'ouvertures (uint24)
    [4-5] batterie mV (uint16)
    """
    model = "CPL03"

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.contact_state = 0
        self.open_count = 0

    def set_contact(self, state: int):
        if state == 1 and self.contact_state == 0:
            self.open_count += 1
        self.contact_state = state

    def encode(self) -> bytes:
        flags = (self.contact_state & 0x01) | ((1 if self.fault else 0) << 1)
        return bytes([flags]) + self.open_count.to_bytes(3, "big") + struct.pack(">H", self.battery_mv)


class PF52(Device):
    """Compteur de passage. 7 octets :
    [0-1] entrées cumulées (uint16)  [2-3] sorties cumulées (uint16)
    [4] défaut (0/1)  [5-6] batterie mV (uint16)
    """
    model = "PF52"

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.people_in = 0
        self.people_out = 0

    def step(self):
        super().step()
        self.people_in = (self.people_in + random.randint(0, 8)) % 65536   # un uint16 "reboucle" après 65535
        inside = (self.people_in - self.people_out) % 65536
        self.people_out = (self.people_out + random.randint(0, min(inside, 8))) % 65536

    def encode(self) -> bytes:
        # B = entier non signé sur 1 octet ; avec ">", aucun octet de remplissage n'est inséré
        return struct.pack(">HHBH", self.people_in, self.people_out, 1 if self.fault else 0, self.battery_mv)