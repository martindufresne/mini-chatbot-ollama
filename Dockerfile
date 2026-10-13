FROM ubuntu:22.04

# Configuration pour eviter les questions interactives pendant l'installation
ENV DEBIAN_FRONTEND=noninteractive
ENV OLLAMA_HOST=127.0.0.1:11434
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# 1. Installation des dependances systeme et de Node.js (version 20 LTS)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    zstd \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*


# 2. Installation du moteur Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# 3. Inclusion du modele qwen2.5:0.5b directement dans l'image (Bake)
# Cette etape garantit que le conteneur demarre immediatement sans telechargement au demarrage
RUN ollama serve & \
    OLLAMA_PID=$! ; \
    echo "Attente de l'initialisation temporaire d'Ollama..." ; \
    while ! curl -s http://127.0.0.1:11434/api/tags > /dev/null; do sleep 1; done ; \
    echo "Telechargement du modele qwen2.5:0.5b..." ; \
    ollama pull qwen2.5:0.5b ; \
    kill $OLLAMA_PID

# 4. Installation des modules npm
COPY package*.json ./
RUN npm install --omit=dev

# 5. Copie des fichiers sources de l'application
COPY . .

# Nettoyage des fins de ligne Windows (CRLF vers LF) et permissions
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh


# Port par defaut
EXPOSE 3000

# Script d'entree orchestrant Ollama et Node.js
ENTRYPOINT ["./entrypoint.sh"]
