// Simboli personalizzati (foglio font/glyph_E5.png generato da build/grafica.py): stesso ordine di GLIFI in Python.
const GLIFI = ['goccia_piena', 'goccia_meta', 'goccia_vuota', 'sole', 'anello', 'verbena', 'umanita_on', 'umanita_off',
  'cuore_battito', 'teschio', 'luna', 'zanne', 'det_piena', 'det_meta', 'det_vuota', 'volonta', 'fiuto'];
export function car(nome) { const i = GLIFI.indexOf(nome); return i < 0 ? '' : String.fromCharCode(0xE500 + i); }
