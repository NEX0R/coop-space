# Approvare e tornare indietro

Guida per gli assistenti. Leggila quando una proposta va approvata, quando la fusione automatica non riesce o quando bisogna annullare una modifica.

## Approvare

- **Chi approva**: chiunque del gruppo (deciso il 16/11), dopo aver provato la proposta nel gioco. Approvare vuol dire **togliere la bozza** (pulsante **Ready for review** nella pagina della pull request): il pulsante "Merge" non serve.
- L'assistente toglie la bozza **solo se la persona lo dice in modo esplicito** ("fondi", "approva"): sul PC `gh pr ready <N>`; dal telefono non si può da comando, la persona preme il pulsante. Mai di tua iniziativa.
- **Fusione automatica** (`.github/workflows/merge-automatico.yml`, voluta da Nexor il 16/11): una pull request si fonde da sola in `main` quando non è in bozza, il titolo non inizia con "In corso" e il controllo `build` dell'ultimo commit è verde. Succede quando finisce la build, oppure appena si toglie la bozza se la build era già verde. Vale solo per i rami di questo repository.
  - Per **tenerla ferma**: lasciala in bozza, o rimettila in bozza ("Convert to draft" nella pagina della pull request).
  - Se **non riesce** (di solito conflitti con `main`): l'automazione scrive un commento nella pull request. Aggiorna il ramo (`git fetch origin && git merge origin/main`), risolvi tenendo le righe di tutti e due, rilancia `npm run verify` e fai push: si fonde alla build successiva.
  - Dopo la fusione l'automazione cancella l'anteprima e il ramo fuso, ricrea "ultima-versione" e ripubblica il sito. Se restano indietro, guarda la scheda Actions.

## Tornare indietro (il "backup")

Niente si perde: `main` è protetto (niente push forzati né cancellazioni) e ogni modifica resta nella storia delle pull request.

- **Una versione vecchia da giocare subito**: ogni fusione lascia anche una release fissa **"Versione <numero> (copia di riserva)"** (tag `versione-<numero>`, mai cancellata), con `.mcaddon` e mondo di prova. Si scarica dalla pagina Releases. Attenzione: una versione vecchia ha un numero più basso, quindi Minecraft la rifiuta come "Pacchetto doppio" finché è installata quella nuova (prima va eliminata da Impostazioni → Archiviazione). Per tornare indietro **per tutti** si usa Revert (qui sotto).

- **La persona**: nella pagina della pull request fusa c'è il pulsante **Revert**. Crea una pull request che annulla quella modifica; quando viene fusa il progetto torna com'era e "Ultima versione" si ricrea con un numero più alto, quindi il telefono la accetta.
- **L'assistente**, anche dal cloud: `git switch main && git pull && git switch -c annulla-pr-<N>`, poi `git revert -m 1 <commit di merge della PR>` (lo trovi con `git log --merges --oneline`), `npm run verify`, `git push -u origin annulla-pr-<N>` e la pull request con `gh api` come al solito (titolo `Annulla #<N>: …`).
- **Un solo file**: `git checkout <commit buono> -- <file>` su un ramo nuovo, poi pull request.
