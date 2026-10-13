# Mini chatbot autonome avec Ollama et Node.js sous Docker

Ce depot contient le code source fonctionnel et le materiel pedagogique pour un atelier sur la conteneurisation d'un modele d'intelligence artificielle local (LLM) et son deploiement sur la plateforme Render.

---

## 1. Description du projet

L'application associe deux briques logicielles au sein d'un conteneur Docker unique :
1. **Ollama** : Moteur d'inference local executant le modele quantifie `qwen2.5:0.5b` (environ 500 millions de parametres, ~398 Mo de poids).
2. **Serveur Node.js (Express)** : Serveur d'application servant une interface de discussion en JavaScript vanille et assurant la diffusion en continu des reponses grace au protocole Server-Sent Events (SSE).

Ce montage est specialement calibre pour respecter les limites strictes du plan gratuit de Render (512 Mo de memoire vive maximale et processeur virtuel partage).

---

## 2. Structure du repertoire

```text
.
├── Dockerfile                  # Construction de l'image (Ubuntu, Node 20, Ollama et bake du modele)
├── entrypoint.sh               # Script de demarrage d'Ollama et de Node.js
├── package.json                # Dependances Node.js (Express)
├── server.js                   # Serveur mandataire Express et gestion du flux SSE
├── docker-compose.yml          # Configuration de lancement rapide pour Docker en local
├── .dockerignore               # Fichiers exclus de la construction Docker
├── public/                     # Fichiers statiques du client Web
│   ├── index.html              # Interface utilisateur
│   ├── style.css               # Mise en page et styles
│   └── app.js                  # Logique de clavardage et gestion du flux
└── cours/                      # Documents pedagogiques
    ├── notes_de_cours.md       # Guide detaille a l'intention de l'enseignant
    └── cahier_du_participant.md # Guide pas-a-pas pour les etudiants
```

---

## 3. Demarrage rapide en local avec Docker

### Option A : Avec Docker Compose
```bash
docker compose up --build
```
L'application sera accessible a l'adresse : `http://localhost:3000`.

### Option B : Avec la commande Docker standard
```bash
# 1. Fabrication de l'image
docker build -t mini-chatbot-ollama .

# 2. Execution du conteneur
docker run -p 3000:3000 --name chatbot-local --rm mini-chatbot-ollama
```

---

## 4. Deploiement sur Render

1. Publiez ce code sur un depot **GitHub** (public ou prive).
2. Sur **Render**, creez un nouveau **Web Service**.
3. Selectionnez votre depot GitHub.
4. Choisissez l'environnement **Docker**.
5. Selectionnez le plan gratuit (**Free**).
6. Lancez le deploiement (**Deploy Web Service**).

Le service sera accessible sous une adresse publique du type `https://votre-service.onrender.com`.

---

## 5. Contraintes techniques cles a retenir

* **Memoire vive plafonnee a 512 Mo** : L'utilisation du modele `qwen2.5:0.5b` couplee au reglage `num_ctx: 1024` dans `server.js` maintient la consommation entre 420 Mo et 480 Mo, evitant ainsi l'erreur 137 (OOMKilled).
* **Stockage ephemere et pre-telechargement** : Le modele est telecharge durant l'etape `docker build` (le "Bake") afin d'eviter un delai de telechargement lors des redemarrages.
* **Mise en veille automatique** : Le service s'endort apres 15 minutes d'inactivite sur le plan gratuit de Render. Le premier chargement suivant prend entre 45 et 80 secondes.
