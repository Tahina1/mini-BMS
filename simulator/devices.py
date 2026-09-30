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