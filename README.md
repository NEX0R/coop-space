# Coop Space

Add-on per Minecraft Bedrock fatti in tre, con Claude Code e Codex.

## Scaricare l'ultima versione

Vai su **Releases → Ultima versione**, scarica `coop-space.mcaddon` sul telefono e aprilo: Minecraft lo importa da solo. Poi attiva i pacchetti "Coop Space" nelle impostazioni del mondo.

## Lavorare al progetto

- Le regole e il funzionamento sono in [`AGENTS.md`](AGENTS.md). Il tuo assistente IA lo legge da solo: chiedigli "spiegami come funziona il progetto".
- I compiti e chi li fa sono in [`TASKS.md`](TASKS.md).
- Ogni modifica passa da una pull request, che viene controllata in automatico dal validatore ufficiale di Mojang.

## Comandi (per gli assistenti o al PC)

```
npm install       installa gli strumenti
npm run verify    controlla l'add-on (deve dare 0 errori)
npm run package   crea dist/coop-space.mcaddon
```
