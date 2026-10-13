const zoneDiscussion = document.getElementById('zoneDiscussion');
const formulaireMessage = document.getElementById('formulaireMessage');
const champMessage = document.getElementById('champMessage');
const boutonEnvoyer = document.getElementById('boutonEnvoyer');
const pastilleStatut = document.getElementById('pastilleStatut');
const texteStatut = document.getElementById('texteStatut');

// Historique en memoire dans le navigateur
const historiqueMessages = [];

// Verification de l'etat d'Ollama
async function verifierStatutServeur() {
  try {
    const reponse = await fetch('/api/status');
    const donnees = await reponse.json();

    if (reponse.ok && donnees.status === 'pret') {
      pastilleStatut.className = 'pastille actif';
      texteStatut.textContent = `Modele ${donnees.modele} pret`;
      boutonEnvoyer.disabled = false;
    } else {
      pastilleStatut.className = 'pastille';
      texteStatut.textContent = donnees.message || 'Chargement en cours...';
      boutonEnvoyer.disabled = false;
    }
  } catch (erreur) {
    pastilleStatut.className = 'pastille erreur';
    texteStatut.textContent = 'Service non joignable';
  }
}

// Verification initiale et rafraichissement periodique
verifierStatutServeur();
setInterval(verifierStatutServeur, 15000);

// Ajustement dynamique de la hauteur du champ texte
champMessage.addEventListener('input', () => {
  champMessage.style.height = 'auto';
  champMessage.style.height = `${Math.min(champMessage.scrollHeight, 120)}px`;
});

// Envoi avec la touche Entree (sans Maj)
champMessage.addEventListener('keydown', (evenement) => {
  if (evenement.key === 'Enter' && !evenement.shiftKey) {
    evenement.preventDefault();
    formulaireMessage.dispatchEvent(new Event('submit'));
  }
});

// Ajout d'une bulle dans la discussion
function ajouterBulle(role, contenuInitial = '') {
  const elementMessage = document.createElement('div');
  elementMessage.className = `message ${role}`;

  const etiquetteAuteur = document.createElement('span');
  etiquetteAuteur.className = 'auteur';
  etiquetteAuteur.textContent = role === 'usager' ? 'Vous' : 'Assistant (Qwen 0.5B)';

  const corpsBulle = document.createElement('div');
  corpsBulle.className = 'bulle';
  corpsBulle.textContent = contenuInitial;

  elementMessage.appendChild(etiquetteAuteur);
  elementMessage.appendChild(corpsBulle);
  zoneDiscussion.appendChild(elementMessage);

  faireDefilerVersLeBas();

  return corpsBulle;
}

function faireDefilerVersLeBas() {
  zoneDiscussion.scrollTop = zoneDiscussion.scrollHeight;
}

// Gestion de la soumission du formulaire
formulaireMessage.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();

  const texteSaisi = champMessage.value.trim();
  if (!texteSaisi) return;

  // Affichage du message usager
  ajouterBulle('usager', texteSaisi);
  historiqueMessages.push({ role: 'user', content: texteSaisi });

  champMessage.value = '';
  champMessage.style.height = 'auto';
  champMessage.disabled = true;
  boutonEnvoyer.disabled = true;

  // Creation de la bulle vide pour la reponse progressive de l'assistant
  const bulleReponse = ajouterBulle('assistant', '');
  bulleReponse.textContent = 'Reflexion en cours...';

  try {
    const reponse = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: historiqueMessages })
    });

    if (!reponse.ok) {
      const erreurData = await reponse.json();
      bulleReponse.textContent = `Erreur: ${erreurData.erreur || 'Reponse invalide du serveur'}`;
      return;
    }

    bulleReponse.textContent = '';
    let texteCompletAssistant = '';

    const lecteur = reponse.body.getReader();
    const decodeur = new TextDecoder();

    while (true) {
      const { done, value } = await lecteur.read();
      if (done) break;

      const paquet = decodeur.decode(value, { stream: true });
      const lignes = paquet.split('\n');

      for (const ligne of lignes) {
        if (ligne.startsWith('data: ')) {
          const chargeUtile = ligne.substring(6).trim();

          if (chargeUtile === '[FIN]') {
            continue;
          }

          try {
            const donneesJson = JSON.parse(chargeUtile);
            if (donneesJson.texte) {
              texteCompletAssistant += donneesJson.texte;
              bulleReponse.textContent = texteCompletAssistant;
              faireDefilerVersLeBas();
            } else if (donneesJson.erreur) {
              bulleReponse.textContent += ` [Erreur: ${donneesJson.erreur}]`;
            }
          } catch (e) {
            // Fragment ignore
          }
        }
      }
    }

    historiqueMessages.push({ role: 'assistant', content: texteCompletAssistant });
  } catch (erreur) {
    bulleReponse.textContent = `Erreur lors de la communication: ${erreur.message}`;
  } finally {
    champMessage.disabled = false;
    boutonEnvoyer.disabled = false;
    champMessage.focus();
    faireDefilerVersLeBas();
  }
});
