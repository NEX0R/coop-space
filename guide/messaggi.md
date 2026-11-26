# Messaggi e richieste del team

Guida per gli assistenti. Leggila quando devi scrivere, leggere o rispondere a un messaggio, o quando arriva una richiesta dal sito.

Il gruppo si parla attraverso questo repository, non con copia e incolla. Chi c'è lo dice `team.json` (solo soprannomi). Ricorda che **tutto è pubblico**: niente nomi veri né dati personali, nemmeno nei messaggi (`AGENTS.md`, "Privacy").

## Messaggi

Sono issue con l'etichetta `messaggio`. Titolo `Per <soprannome>: …` oppure `Per tutti: …`. Il destinatario è l'assegnatario (il suo account GitHub); senza assegnatario il messaggio è per tutti. Firma sempre: `— assistente di <soprannome> (Claude Code / Codex)`.

- Scrivere: `gh api repos/NEX0R/coop-space/issues -f title="Per <soprannome>: …" -f body="…" -f "labels[]=messaggio" -f "assignees[]=<account>"`
- Rispondere: `gh api repos/NEX0R/coop-space/issues/<N>/comments -f body="…"`. Chiudere quando è risolto: `gh api -X PATCH repos/NEX0R/coop-space/issues/<N> -f state=closed`
- Le persone possono scrivere dal sito ("Scrivi al team").

**Leggere**: con Claude Code l'hook di avvio consegna all'assistente i messaggi per la sua persona ("MESSAGGI DEL TEAM"). Con Codex leggili tu all'inizio con `gh api "repos/NEX0R/coop-space/issues?labels=messaggio&state=open"`; se `gh` non funziona, chiedi alla persona di guardare "Richieste del team" nel sito.

**Riferire**: racconta alla persona i messaggi per lei con parole semplici e chiedile se e cosa rispondere. Non rispondere a suo nome senza il suo ok.

**Quando scrivere**: per una decisione o un aiuto che serve a qualcuno, per passare un lavoro, per un problema che blocca, per un cambiamento che tocca il lavoro degli altri. Quello che sta già in `TASKS.md` o in una pull request non va ripetuto.

## Richieste dal sito

Arrivano come issue con le etichette `accesso`, `idea`, `problema`, `messaggio`; leggile con `gh api repos/NEX0R/coop-space/issues`.

- **idea**: se il team la approva diventa un compito in `TASKS.md`, e la pull request che la realizza scrive `Chiude #N`.
- **problema**: si affronta con la skill `debug-addon` e `guide/prova-nel-gioco.md`.
- **accesso**: le gestisce l'automazione `.github/workflows/accesso.yml` (script `scripts/accesso.mjs`, nessuna IA accesa). Alla richiesta (titolo `Accesso: <soprannome>` o modulo del sito) GitHub controlla il soprannome in `team.json` e chiede l'ok a Nexor; quando **Nexor** (solo lui, proprietario del repository) risponde `ok`, GitHub manda l'invito, apre la proposta che scrive l'account in `team.json` (si fonde da sola) e chiude la richiesta. Se sei l'assistente di Nexor, riferiscigli le richieste aperte e ricordagli che basta rispondere `ok` se conosce la persona.

## Accesso automatico: il segreto `TOKEN_INVITI`

Le automazioni normali di GitHub non possono invitare persone: serve un token di Nexor, salvato come segreto del repository. Si crea **una volta** (e si rinnova alla scadenza; se è scaduto, l'automazione lo scrive nella richiesta). Guida Nexor passo per passo, ma **il token non deve mai passare dalla chat né finire in un file**:

1. GitHub → foto in alto a destra → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Nome `coop-space inviti`; scadenza 1 anno; **Repository access** → **Only select repositories** → `coop-space`.
3. **Permissions** del repository: **Administration** → Read and write (serve per gli inviti); **Contents** → Read and write; **Pull requests** → Read and write. Nient'altro.
4. **Generate token** e copia il token.
5. Sul PC Nexor scrive lui nel prompt `! gh secret set TOKEN_INVITI --repo NEX0R/coop-space` e incolla il token quando lo chiede (oppure: repository → Settings → Secrets and variables → Actions → New repository secret).
