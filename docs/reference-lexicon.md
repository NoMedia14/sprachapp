# Referenzwortschatz

Der Bereich `Fortschritt` enthält je Sprache einen versionierten Referenzwortschatz:

- `pt-BR-cefr-mapped-reference-v3`: 3.000 brasilianisch-portugiesische Einträge
- `en-cefr-reference-v3`: 3.000 englische Einträge

Die App berechnet sämtliche Summen und Fortschrittswerte aus den tatsächlich geladenen Einträgen. Im Anwendungscode gibt es keine separat gepflegten Zielzahlen.

## Einordnung

Die Referenz ist eine CEFR-abgeglichene Lernorientierung und keine offizielle GER-Wortliste. Englisch nutzt Lemma- und Stufenwerte aus dem offenen `Words-CEFR-Dataset`. Portugiesisch wird über ein portugiesisch-englisches Wörterbuch auf diese Stufen abgebildet und innerhalb der Stufen nach brasilianischer Nutzungshäufigkeit sortiert.

| Stufe | Englisch | Portugiesisch (BR) |
| --- | ---: | ---: |
| A1 | 500 | 620 |
| A2 | 600 | 620 |
| B1 | 700 | 660 |
| B2 | 600 | 550 |
| C1 | 400 | 400 |
| C2 | 200 | 150 |

Diese Zuordnung eignet sich für einen motivierenden Lernfortschritt, ersetzt aber keine Sprachprüfung. Insbesondere Grammatik, Hörverstehen, Lesen, Schreiben und Sprechen werden dadurch nicht bewertet.

## Datenquellen

Die Datei `src/data/referenceLexicon.generated.json` wird reproduzierbar aus folgenden offenen Quellen erzeugt:

- FrequencyWords 2018 für die Reihenfolge nach Nutzungshäufigkeit: MIT-Lizenz, https://github.com/hermitdave/FrequencyWords
- Words-CEFR-Dataset für englische Lemmata und die CEFR-Zuordnung: MIT-Lizenz, https://github.com/Maximax67/Words-CEFR-Dataset
- FreeDict `eng-deu` 1.9-fd1 für englische Lemmata und deutsche Wörterbuchentsprechungen: die Quelldatei nennt GPLv3 und AGPLv3 für unterschiedliche Teile, https://download.freedict.org/dictionaries/eng-deu/1.9-fd1/
- FreeDict `por-deu` 0.2 für portugiesische Lemmata und deutsche Wörterbuchentsprechungen: GPLv2 oder später, https://download.freedict.org/dictionaries/por-deu/0.2/
- FreeDict `por-eng` 0.2 für die portugiesisch-englische Stufenabbildung: Wörterbuchlizenz laut Quelldatei, https://download.freedict.org/dictionaries/por-eng/0.2/

Die erzeugte Datendatei ist getrennt vom Anwendungscode zu betrachten und unter Beachtung der jeweiligen Quelldatenlizenzen weiterzugeben. Die vollständigen Quelldateien und Lizenztexte sind über die oben genannten Links verfügbar.

## Übersetzungsqualität

FreeDict kann für ein Wort mehrere Bedeutungen enthalten. Der Generator priorisiert deshalb häufige deutsche Entsprechungen und enthält für zentrale portugiesische Grundwörter kuratierte A1/A2-Korrekturen. Häufige gebeugte Verbformen, Kontraktionen und erkennbare Eigennamen werden aus der portugiesischen Lemmaliste entfernt. Im fortgeschrittenen portugiesischen Bereich werden häufigere C2-Kandidaten nach C1 verschoben, wenn die direkte Wörterbuchabbildung dort zu wenig Einträge liefert.

Ein Wörterbuchvorschlag wird in der Oberfläche nicht als geprüfte Übersetzung ausgegeben. Wenn ein Referenzwort zum Lernen hinzugefügt wird, prüft die vorhandene OpenAI-Übersetzung das Wort erneut und erzeugt natürliche Beispielsätze.

## Aktualisierung

Unter Windows:

```powershell
py -3 scripts/build-reference-lexicon.py
```

Unter macOS oder Linux:

```bash
python3 scripts/build-reference-lexicon.py
```

Das Skript lädt die angegebenen Versionen, validiert die Zielgröße und überschreibt anschließend `src/data/referenceLexicon.generated.json`.

Für eigene kuratierte JSON-Imports bleibt zusätzlich der bestehende Ablauf verfügbar:

```bash
npm run reference:import -- data/reference/pt-BR-reference-v3.json
```

## Fortschrittsregel

Eine Stufe gilt appintern als abgeschlossen, wenn mindestens `85%` ihrer Referenzlemmata durch das bestehende Spaced-Repetition-System als beherrscht gelten. Eine höhere Stufe wird erst als erreicht angezeigt, wenn auch die darunterliegenden Stufen abgeschlossen sind.
