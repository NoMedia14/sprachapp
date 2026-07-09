# Sprachapp

Wartbare Basis fuer eine Deutsch/Brasilianisch-Portugiesisch-Vokabelapp mit React, Supabase und optionalem DeepL/OpenAI-Provider.

## Features

- Wort in Deutsch oder Portugiesisch BR eingeben und uebersetzen
- Beispielsatz mit hervorgehobenem Suchwort
- Woerter speichern, lokal sofort nutzbar und spaeter mit Supabase
- Woerterbereich als einfache Liste untereinander
- Wiederholungsbereich mit drei Antworten: Nochmal, Gut, Leicht
- Feste Wiederholungsstufen: 1, 3, 7, 14, 21 und 60 Tage
- Supabase Migration und Edge Function fuer serverseitige API-Keys

## Start

```bash
npm install
npm run dev
```

Ohne `.env` nutzt die App LocalStorage und versucht fuer lokale Entwicklung eine oeffentliche Uebersetzungs-API. Wenn diese nicht erreichbar ist, nutzt sie ein kleines lokales Fallback-Woerterbuch. Mit Supabase:

```bash
cp .env.example .env
```

Dann `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen.

## Supabase

1. Migration aus `supabase/migrations/0001_initial_schema.sql` ausfuehren.
2. Edge Function `translate-word` deployen.
3. Secrets setzen:

```bash
supabase secrets set OPENAI_API_KEY=...
supabase secrets set OPENAI_MODEL=gpt-5.4-mini
supabase secrets set DEEPL_API_KEY=...
```

Wenn `OPENAI_API_KEY` gesetzt ist, erzeugt die Function Uebersetzung und Beispielsatz in einem Schritt. Wenn nur `DEEPL_API_KEY` gesetzt ist, wird DeepL fuer die Uebersetzung verwendet und der Beispielsatz bleibt zunaechst ein Template.

## Naechste sinnvolle Schritte

- Supabase Auth Screen ergaenzen
- Import/Export fuer Anki CSV/APKG planen
- Tags, Notizen und Wortarten hinzufuegen
- Servervalidierung und Rate Limits fuer die Edge Function ergaenzen
