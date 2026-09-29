import paho.mqtt.client as mqtt

# VERSION2: the new API callbacks of paho-mqtt 2.xx
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="hello")
client.connect("localhost", 1883)
client.loop_start() #start a thread that manage traffic

info = client.publish(topic="bms/test/hello", payload="Hello from python", qos=1)
info.wait_for_publish()

client.loop_stop()
client.disconnect()
print("Sent")