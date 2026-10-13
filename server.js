const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const MODEL_NAME = process.env.MODEL_NAME || 'qwen2.5:0.5b';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Verification de l'etat du service
app.get('/api/status', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!response.ok) {
      return res.status(503).json({
        status: 'en_attente',
        message: 'Le serveur Ollama ne repond pas correctement.'
      });
    }
    const data = await response.json();
    const modeleDisponible = data.models?.some(m => m.name.startsWith(MODEL_NAME));

    return res.json({
      status: 'pret',
      modele: MODEL_NAME,
      modeleCharge: modeleDisponible,
      hote: OLLAMA_HOST
    });
  } catch (error) {
    return res.status(503).json({
      status: 'hors_ligne',
      message: 'Impossible de joindre le service Ollama local.',
      erreur: error.message
    });
  }
});

// Point d'entree pour la discussion avec le modele
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      erreur: 'Le tableau de messages est requis.'
    });
  }

  try {
    // Configuration pour limiter l'utilisation de la memoire vive
    // num_ctx a 1024 reduit significativement l'empreinte memoire du cache KV
    const requeteOllama = {
      model: MODEL_NAME,
      messages: messages,
      stream: true,
      options: {
        num_ctx: 1024,
        temperature: 0.7
      }
    };

    const reponseOllama = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requeteOllama)
    });

    if (!reponseOllama.ok) {
      const detailsErreur = await reponseOllama.text();
      return res.status(reponseOllama.status).json({
        erreur: 'Erreur recue du service Ollama.',
        details: detailsErreur
      });
    }

    // Configuration de l'en-tete pour flux continu (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = reponseOllama.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lignes = chunk.split('\n').filter(ligne => ligne.trim() !== '');

      for (const ligne of lignes) {
        try {
          const json = JSON.parse(ligne);
          if (json.message && json.message.content) {
            res.write(`data: ${JSON.stringify({ texte: json.message.content })}\n\n`);
          }
          if (json.done) {
            res.write('data: [FIN]\n\n');
          }
        } catch (e) {
          // Ignorer les fragments JSON incomplets
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('Erreur lors du traitement de la requete de clavardage :', error);
    if (!res.headersSent) {
      res.status(500).json({
        erreur: 'Erreur interne lors de la communication avec le modele.',
        details: error.message
      });
    } else {
      res.write(`data: ${JSON.stringify({ erreur: error.message })}\n\n`);
      res.end();
    }
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Serveur web demarre sur le port ${port}`);
  console.log(`Connexion cible pour Ollama : ${OLLAMA_HOST}`);
  console.log(`Modele configure : ${MODEL_NAME}`);
});
