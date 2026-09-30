"""
Simulateur = capteurs + gateway + (un peu de) Network Server.
On saute la radio : la gateway reçoit directement les octets du capteur,
ajoute les métadonnées radio et publie un JSON "façon Network Server".
"""
import base64
import json
import os
import random
import time
from datetime import datetime, timedelta, timezone

import paho.mqtt.client as mqtt

from devices import S31

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
TENANT = os.getenv("TENANT", "ascencia")


class Gateway:
    def __init__(self, gateway_id: str):
        self.id = gateway_id
        self.up_topic = f"bms/{TENANT}/gw/{gateway_id}/up"
        self.status_topic = f"bms/{TENANT}/gw/{gateway_id}/status"
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"sim-{gateway_id}")
        # Le testament : publié PAR LE BROKER si on disparaît sans se déconnecter
        self.client.will_set(self.status_topic, json.dumps({"state": "offline"}), qos=1, retain=True)

    def connect(self):
        while True:                   # le broker n'est peut-être pas encore prêt : on réessaie
            try:
                self.client.connect(MQTT_HOST, MQTT_PORT, keepalive=15)
                break
            except OSError as e:
                print(f"[gw] broker indisponible ({e}), nouvel essai dans 3 s")
                time.sleep(3)
        self.client.loop_start()
        # retain : tout nouvel abonné saura immédiatement que la gateway est en ligne
        self.client.publish(self.status_topic, json.dumps({"state": "online"}), qos=1, retain=True)
        print(f"[gw] {self.id} connecté à {MQTT_HOST}:{MQTT_PORT}")

    def forward(self, device, payload: bytes):
        ts = datetime.now(timezone.utc) + timedelta(seconds=device.clock_offset_s)
        uplink = {
            "devEui": device.dev_eui,
            "fCnt": device.next_f_cnt(),
            "fPort": device.f_port,
            "data": base64.b64encode(payload).decode(),   # octets -> texte pour voyager dans du JSON
            "time": ts.isoformat(),
            "rxInfo": [{"gatewayId": self.id, "rssi": random.randint(-110, -60), "snr": round(random.uniform(-5, 10), 1)}],
        }
        self.publish(uplink)
        print(f"[{device.model} {device.dev_eui}] fCnt={uplink['fCnt']} hex={payload.hex()}")

    def publish(self, message):
        body = message if isinstance(message, str) else json.dumps(message)
        self.client.publish(self.up_topic, body, qos=1)


def main():
    gw = Gateway("dlos8n-01")
    gw.connect()
    s31 = S31("A84041000000A001", "Salle électrique 1 - T/H", interval_s=10)

    while True:
        s31.step()
        gw.forward(s31, s31.encode())
        time.sleep(s31.interval_s)


if __name__ == "__main__":
    main()