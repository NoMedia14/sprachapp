# Referenzwortschatz

Der Bereich `Fortschritt` nutzt versionierte Referenzwortschätze je Sprache:

- `pt-BR-reference-v1`
- `en-reference-v1`

Die aktuell in der App enthaltenen Einträge sind eine kleine kuratierte Startreferenz. Sie sind nicht als offizieller GER-Wortschatz zu verstehen und werden in der UI deshalb als geschätzter Wortschatzfortschritt dargestellt.

## Datenquellen und Lizenzstatus

Aktueller Stand:

- Quelle: eigene kuratierte Startliste, KI-unterstützt klassifiziert und manuell plausibilisiert
- Lizenzstatus: projektintern erzeugte Seed-Daten
- Einschränkung: nicht vollständig, nicht offiziell, nicht als Sprachtest geeignet

Für einen vollständigen Wortschatz darf keine angeblich offizielle Liste erfunden werden. Benötigt wird ein geprüfter Datensatz mit erlaubter Lizenz, zum Beispiel eine eigene Wortliste, ein frei nutzbarer Frequenzdatensatz oder ein kommerziell lizenzierter Wortschatz.

## Klassifikation

Jeder Eintrag enthält:

- Sprache
- Lemma
- normalisierte Schreibweise
- Wortart
- Bedeutung
- optionale deutsche Übersetzung
- GER-Stufe
- Häufigkeitswert
- Streuungswert
- Klassifikationsquelle
- Konfidenzwert
- Referenzversion
- Themen

Der zentrale Konfidenzgrenzwert für Imports liegt bei `0.75`. Einträge unterhalb dieses Werts müssen als `UNASSIGNED` importiert werden und zählen nicht in die Fortschritts-Nenner.

## Importprozess

Ein größerer Referenzwortschatz wird als JSON-Datei importiert:

```bash
npm run reference:import -- data/reference/pt-BR-reference-v2.json
```

Das Skript validiert die Einträge und erzeugt standardmäßig:

```text
supabase/seed/reference-lexicon-upsert.sql
```

Diese SQL-Datei kann anschließend kontrolliert im Supabase SQL Editor ausgeführt werden.

## Fortschrittsregel

Eine GER-Stufe gilt appintern als abgeschlossen, wenn mindestens `85%` der Referenzlemmata dieser Stufe durch das bestehende Spaced-Repetition-System als beherrscht gelten.

Wichtig: Eine höhere Stufe wird nur als erreicht angezeigt, wenn die darunterliegenden Stufen ebenfalls abgeschlossen sind.
