#!/bin/bash
set -e

echo "=== Demarrage du conteneur ==="

# 1. Demarrage du service Ollama en arriere-plan
echo "Lancement du service Ollama..."
ollama serve &
OLLAMA_PID=$!

# 2. Attente de la disponibilite du service Ollama
echo "Verification de la disponibilite d'Ollama sur le port 11434..."
compteur=0
max_tentatives=30

until curl -s http://127.0.0.1:11434/api/tags > /dev/null; do
  sleep 1
  compteur=$((compteur + 1))
  if [ $compteur -ge $max_tentatives ]; then
    echo "Erreur : Le service Ollama n'a pas demarre a temps."
    exit 1
  fi
done

echo "Ollama est operationnel."

# 3. Verification de la presence du modele (securite si le modele n'a pas ete inclus lors du build)
echo "Verification de la presence du modele qwen2.5:0.5b..."
if ! ollama list | grep -q "qwen2.5:0.5b"; then
  echo "Modele non trouve dans le stockage local. Telechargement en cours..."
  ollama pull qwen2.5:0.5b
else
  echo "Modele qwen2.5:0.5b deja present."
fi

# 4. Demarrage du serveur Node.js (Express)
# Render definit automatiquement la variable d'environnement PORT
PORT_APPLICATION=${PORT:-3000}
echo "Lancement de l'application Node.js sur le port ${PORT_APPLICATION}..."

# Exec permet a Node.js de remplacer le processus du script et de recevoir les signaux d'arret (SIGTERM)
exec node server.js
