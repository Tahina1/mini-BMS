import time

import paho.mqtt.client as mqtt

# VERSION2 : la nouvelle API de callbacks de paho-mqtt 2.x
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="hello")
client.connect("localhost", 1883)
client.loop_start()          # démarre un thread qui gère le réseau (envoi, réception, keepalive)

# connect() envoie la demande de connexion ; la réponse du broker (CONNACK) arrive un peu plus tard.
# On attend jusqu'à 5 s que la connexion soit confirmée avant de publier.
for _ in range(50):
    if client.is_connected():
        break
    time.sleep(0.1)
print("connecté :", client.is_connected())

info = client.publish("bms/test/hello", "bonjour depuis Python", qos=1)
# En QoS 1, le broker répond par un accusé de réception (PUBACK).
# wait_for_publish ne renvoie rien : on vérifie ensuite avec is_published().
info.wait_for_publish(timeout=5)
print("accusé de réception reçu :", info.is_published())

client.loop_stop()
client.disconnect()