import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: '.',
  outDir: '.output',
  manifest: {
    name: 'MoodleLoader',
    description:
      'Lädt komplette Moodle-Kurse inkl. Dateien, Ordnern, Abgaben und externen Cloud-Links mit einem Klick herunter.',
    // Keine eigene `version` hier setzen - WXT übernimmt sie automatisch aus package.json,
    // damit es nur eine einzige Stelle gibt, an der die Versionsnummer gepflegt wird.
    permissions: ['downloads', 'storage', 'activeTab', 'scripting', 'tabs', 'webRequest'],
    // Moodle ist selbst-gehostet und läuft auf beliebigen Domains (Hochschulen, Firmen, ...),
    // daher kann keine feste Host-Liste hinterlegt werden. Der Content-Script prüft selbst,
    // ob die Seite überhaupt eine Moodle-Instanz ist, bevor er aktiv wird.
    host_permissions: ['*://*/*'],
    action: {
      default_title: 'MoodleLoader',
    },
    browser_specific_settings: {
      gecko: {
        id: 'moodleloader@alexanderklauser',
        strict_min_version: '109.0',
      },
    },
  },
});
