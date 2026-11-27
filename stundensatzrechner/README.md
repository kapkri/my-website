# wievonselbstai – Echter-Stundensatz-Rechner (Netlify)

Ein eigenständiger, einbettbarer Rechner als statische Webanwendung. Der PDF-Report wird im Browser erstellt und kann heruntergeladen werden. Der optionale E-Mail-Versand erfolgt über eine Netlify Function und Resend.

## Enthalten

- Mehrstufiger Rechner mit Einnahmen, abrechenbaren Stunden, unbezahlter Arbeitszeit, Betriebskosten und Zielüberschuss
- Berechnung von effektivem Umsatz je Arbeitsstunde, Überschuss je Arbeitsstunde, kostendeckendem Mindeststundensatz und erforderlichem Stundensatz
- Ergebnisübersicht und Zeitverteilung
- PDF-Report zum direkten Download
- Optionale E-Mail-Zustellung über Resend
- Einfache Tenant-Konfiguration in `public/config.js`
- Embed-Darstellung über `?embed=1&tenant=wievonselbstai`
- Netlify Function für den E-Mail-Versand

## Lokal testen

Voraussetzung: Node.js und npm.

```bash
npm install -g netlify-cli
npm run dev
```

Netlify Dev stellt die Website und die Function lokal bereit. Der PDF-Download funktioniert auch ohne E-Mail-Konfiguration. Für den E-Mail-Versand müssen die Umgebungsvariablen gesetzt sein.

## Netlify-Deployment

1. Projekt in ein GitHub-Repository hochladen.
2. In Netlify **Add new site → Import an existing project** auswählen und das Repository verbinden.
3. Build-Einstellungen:
   - Build command: leer lassen
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. Unter **Site configuration → Environment variables** folgende Variablen setzen:

```env
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM=wievonselbstai <reports@DEINE-DOMAIN.DE>
REPLY_TO=kontakt@DEINE-DOMAIN.DE
ALLOWED_ORIGINS=https://DEINE-WEBSITE.DE,https://DEINE-NETLIFY-SITE.NETLIFY.APP
```

`RESEND_FROM` muss eine bei Resend verifizierte Absenderdomain verwenden. `onboarding@resend.dev` ist nur für Resend-Testzwecke geeignet und nicht für den regulären Versand an beliebige Empfänger.

`ALLOWED_ORIGINS` ist eine kommaseparierte Liste erlaubter Origins. Für lokale Tests kann die Variable leer bleiben. Nach Änderung der Variablen muss Netlify die Function mit der aktualisierten Umgebung neu deployen.

Der Browser sendet weiterhin an `/api/send-report`; die Rewrite-Regel in `netlify.toml` leitet intern an `/.netlify/functions/send-report` weiter.

## Einbindung als iFrame

Nach dem Deployment beispielsweise:

```html
<iframe
  src="https://DEINE-NETLIFY-DOMAIN.netlify.app/?embed=1&tenant=wievonselbstai"
  title="Echter-Stundensatz-Rechner"
  loading="lazy"
  style="width:100%;min-height:1100px;border:0;border-radius:16px;"
></iframe>
```

Die Mindesthöhe ist ein Startwert und muss auf der Zielseite getestet werden. Für eine automatische Höhenanpassung ist später ein `postMessage`-Resize-Mechanismus sinnvoll.

## Multi-Tenant-Ausbau

Die erste Version verwendet `public/config.js` als öffentliche Konfiguration. Für einen echten Kundenbetrieb sollte dies durch eine Datenbank ersetzt werden, z. B. Supabase/Postgres. Empfohlene Tabellen:

- `tenants`: Kundenkonto, Status, Branding und Einstellungen
- `calculators`: Rechnertyp und aktivierte Version je Kunde
- `allowed_domains`: freigegebene Einbettungsdomains
- `leads`: nur wenn erforderlich, mit Löschkonzept und passender Rechtsgrundlage

Jede kundenspezifische Tabelle benötigt geeignete Zugriffskontrollen, insbesondere Row Level Security. Service-Schlüssel bleiben ausschließlich serverseitig. Eine Tenant-ID im Embed-Code ist nur eine öffentliche Kennung, kein Geheimnis und keine Berechtigung.

## Sicherheit und Datenschutz

- Die Function prüft Methode, Eingaben, PDF-Signatur und optional die Origin.
- `ALLOWED_ORIGINS` ist eine zusätzliche Browser-Origin-Prüfung, kein vollständiger Schutz gegen automatisierte Direktaufrufe. Vor öffentlichem Produktivbetrieb Rate-Limiting und Bot-Schutz ergänzen.
- API-Schlüssel niemals im Frontend hinterlegen.
- Keine unnötige Speicherung von Rechnerdaten.
- Marketing-Einwilligung getrennt und freiwillig; Newsletter-Versand erfordert einen geeigneten Einwilligungsprozess.
- Datenschutzhinweise, Impressum, Löschfristen und Auftragsverarbeitung vor Produktivbetrieb prüfen.

## Fachliche Annahmen und Grenzen

- Wöchentliche Zusatzzeiten werden mit 4,33 in Monatsstunden umgerechnet.
- Bei der Stundensatz-Variante müssen die abgerechneten Stunden mit den Stunden für die Umsatzberechnung übereinstimmen.
- „Überschuss je Arbeitsstunde“ ist Umsatz abzüglich der eingegebenen Betriebskosten geteilt durch die gesamte Arbeitszeit. Es ist kein Nettolohn.
- Persönliche Steuern, Sozialversicherung, Urlaub, Krankheit, saisonale Schwankungen und nicht angegebene Kosten sind nicht berücksichtigt.
