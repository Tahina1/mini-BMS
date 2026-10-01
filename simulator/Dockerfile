# part d'une image officielle : Linux + Python 3.12
FROM python:3.12-slim
# dossier de travail dans l'image (créé si absent)
WORKDIR /app
# copie d'abord la liste des dépendances seule...
COPY requirements.txt .
# ...et les installe (étape mise en cache)
RUN pip install --no-cache-dir -r requirements.txt
# puis tout le code
COPY . .
# commande lancée au démarrage du conteneur (-u : logs immédiats)
CMD ["python", "-u", "simulator.py"]