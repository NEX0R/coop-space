# Accoglienza di una persona nuova

Guida per gli assistenti. Leggila quando l'hook di avvio scrive "PERSONA NUOVA", quando la persona non è in `team.json` con `"accoglienza": "fatta"`, o quando chiede come funziona il progetto.

**Nessuno del gruppo è programmatore.** Fai tu tutto quello che si può fare da comando; alla persona chiedi solo quello che non puoi fare tu (accettare inviti, fare l'accesso a un account, rispondere a domande). Un passo alla volta, con parole del glossario del `README.md`. Alla fine fai un riepilogo con ✓ e ✗.

**Parti da solo**: avvia l'accoglienza alla tua prima risposta, anche se ti ha scritto solo "ciao"; poi riprendi la sua richiesta.

## 1. Chi è e da dove lavora

Chiedi il **soprannome** (mai il nome vero: il progetto è pubblico), il nome utente GitHub (con Codex non lo sai da solo) e la sua **strada**:

| Strada | Chi (oggi) | Dove gira l'assistente | Prova nel gioco |
| --- | --- | --- | --- |
| **A. PC + Claude Code** | Nexor, Jowa | sul PC | `npm run prova-mc`: Minecraft già pronto sul PC |
| **B. Telefono + app Claude** | Nexor (a volte) | su un computer di Anthropic ("cloud") | mondo di prova dal sito, sul telefono |
| **C. PC + Codex** | ReverendoLupo, Voltex | sul PC | `npm run prova-mc`, come la strada A |
| **D. Telefono + Codex da Ubuntu** | Lepsy | sul telefono, dentro Ubuntu | mondo di prova dal sito, sullo stesso telefono |

## 2. Prepara l'ambiente della sua strada

Controlla tu, in quest'ordine, e sistema quello che manca. Ogni comando che la persona deve lanciare a mano (accessi, EULA) scrivilo pronto da copiare.

**Per tutte le strade**
- `git --version`, `node --version` (serve 20 o più), `gh --version` e `gh auth status`.
- `npm ci`, poi `npm run verify`: deve dare 0 errori e 0 avvisi.
- Accesso in scrittura: `gh api repos/NEX0R/coop-space --jq .permissions.push` deve dare `true`. Se dà `false` o un errore, l'invito non è stato accettato: <https://github.com/NEX0R/coop-space/invitations>. Se non c'è nessun invito, va usato "Chiedi l'accesso" nel sito e Nexor lo manda.
- Sicurezza: autenticazione a due fattori attiva su GitHub (chiedilo, non puoi verificarlo).

**A. PC + Claude Code**: l'hook di avvio installa gli strumenti e aggiorna il progetto da solo. Se manca `gh`: su Windows `winget install GitHub.cli`, poi la persona scrive nel prompt `! gh auth login`. Per la prova sul server (facoltativa) la persona accetta l'EULA di Minecraft scrivendo lei `! npx -y @minecraft/creator-tools@0.21.0 eula`.

**B. Telefono + app Claude**: niente da installare; l'hook fa tutto. Nel cloud `gh pr …` e `gh issue …` sono bloccati: usa sempre `gh api`. Prova sul server e `prova-mc` non partono: la build della pull request fa la prima, il mondo di prova sostituisce il secondo.

**C. PC + Codex**: Codex non ha l'hook di Claude Code né i suoi blocchi automatici, quindi a ogni sessione fai tu i passi di avvio di `AGENTS.md` ("Il giro di lavoro", passo 1) e rispetta le regole con più attenzione. Se manca `gh`: `winget install GitHub.cli` e `gh auth login` (la persona segue il link nel browser). Con il **piano gratuito** Codex ha un limite d'uso: fai controllare alla persona `/status` in Codex e tieni le sessioni corte (un compito per sessione). Per la prova sul server vale l'EULA come nella strada A.

**D. Telefono + Codex da Ubuntu**: la persona arriva qui dopo i passi "Strada D" del `README.md` (Termux, Ubuntu, Codex). Verifica:
- `uname -m` deve dare `aarch64` (telefono a 64 bit);
- dentro Ubuntu: `apt install -y git gh` se mancano, Node 20 o più (se `node --version` è più vecchio, installalo dal sito ufficiale nodejs.org per Linux ARM64);
- `gh auth login`: la persona apre il link e inserisce il codice nel browser del telefono.

Limiti da spiegare: la prova sul server non parte (il server Mojang esiste solo per PC), quindi la fa la build della pull request; la prova nel gioco si fa con il mondo di prova sullo stesso telefono. È una strada della comunità, non ufficiale di OpenAI: se l'accesso a Codex o un comando non funziona, scrivi un messaggio "Per tutti" con l'errore esatto, così lo risolviamo insieme.

## 3. Minecraft

Sul dispositivo dove prova: versione almeno **1.26.60** (in basso a destra nel menu principale).

## 4. Prima prova

- Strade A e C: `npm run prova-mc`, poi la persona entra in "Coop Space - laboratorio".
- Strade B e D: dal sito, "Mondo di prova", aperto con Minecraft chiuso.

Deve comparire in chat "Coop Space <versione> attivo.", e nell'inventario devono esserci il "Blocco di prova Coop", il blocco di ottone e le bacchette da costruzione. Se qualcosa non va: `guide/prova-nel-gioco.md`.

## 5. Se fa già add-on

Se la persona crea già add-on per conto suo (per esempio Jowa), segui `guide/confronto-tecniche.md`: confronti il suo modo di lavorare con il nostro e lo racconti al gruppo.

## 6. Come si lavora

Spiegalo in 5 righe con le parole del glossario (`README.md`): scegli un compito → piano → cartello "occupato" (proposta in bozza) → controlli automatici → prova nel gioco con la lista "Come provarlo" → "Ready for review" → si fonde da sola. Una cosa per proposta, una sessione per compito.

## 7. Prima pull request

Aggiorna la sua riga in `team.json`: `github`, `nome` (il soprannome), `assistente`, `dispositivi`, `"accoglienza": "fatta"`. Se la riga c'è già con il soprannome ma senza `github`, completala. È anche la prova pratica del giro di lavoro.

## 8. Messaggi in sospeso

Se c'è un messaggio di benvenuto per lei, rispondi con il riepilogo dell'accoglienza (senza dati personali) e chiudilo.
