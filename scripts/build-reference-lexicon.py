#!/usr/bin/env python3
"""Build the bundled reference lexicon from reproducible open data sources.

The output is intentionally compact because it is loaded by the browser. The
runtime app derives all totals from the generated entries instead of relying on
hard-coded progress denominators.
"""

from __future__ import annotations

import json
import math
import re
import sqlite3
import tarfile
import tempfile
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "data" / "referenceLexicon.generated.json"
TEI_NAMESPACE = "{http://www.tei-c.org/ns/1.0}"
GENERATED_AT = "2026-07-10T00:00:00.000Z"

LEVEL_SIZES = (
    ("A1", 500),
    ("A2", 600),
    ("B1", 700),
    ("B2", 600),
    ("C1", 400),
    ("C2", 200),
)

PORTUGUESE_LEVEL_SIZES = (
    ("A1", 620),
    ("A2", 620),
    ("B1", 660),
    ("B2", 550),
    ("C1", 400),
    ("C2", 150),
)

SOURCES = {
    "en": {
        "dictionary": "https://download.freedict.org/dictionaries/eng-deu/1.9-fd1/freedict-eng-deu-1.9-fd1.src.tar.xz",
        "archive": "eng-deu.tar.xz",
        "tei": "eng-deu/eng-deu.tei",
        "version": "en-cefr-reference-v3",
    },
    "pt-BR": {
        "dictionary": "https://download.freedict.org/dictionaries/por-deu/0.2/freedict-por-deu-0.2.src.tar.xz",
        "frequency": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt_br/pt_br_50k.txt",
        "archive": "por-deu.tar.xz",
        "tei": "por-deu/por-deu.tei",
        "version": "pt-BR-cefr-mapped-reference-v3",
    },
}

GERMAN_FREQUENCY_URL = (
    "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt"
)

CEFR_DATABASE_URL = (
    "https://raw.githubusercontent.com/Maximax67/Words-CEFR-Dataset/main/word_cefr_minified.db"
)

PORTUGUESE_ENGLISH_DICTIONARY = {
    "url": "https://download.freedict.org/dictionaries/por-eng/0.2/freedict-por-eng-0.2.src.tar.xz",
    "archive": "por-eng.tar.xz",
    "tei": "por-eng/por-eng.tei",
}

POS_MAP = {
    "adj": "Adjektiv",
    "adv": "Adverb",
    "conj": "Konjunktion",
    "interj": "Interjektion",
    "n": "Nomen",
    "num": "Zahlwort",
    "prep": "Präposition",
    "pron": "Pronomen",
    "v": "Verb",
}

EN_FUNCTION_WORDS = {
    "a": "Artikel",
    "an": "Artikel",
    "the": "Artikel",
    "and": "Konjunktion",
    "but": "Konjunktion",
    "or": "Konjunktion",
    "because": "Konjunktion",
    "if": "Konjunktion",
    "although": "Konjunktion",
    "i": "Pronomen",
    "you": "Pronomen",
    "he": "Pronomen",
    "she": "Pronomen",
    "it": "Pronomen",
    "we": "Pronomen",
    "they": "Pronomen",
    "me": "Pronomen",
    "him": "Pronomen",
    "her": "Pronomen",
    "us": "Pronomen",
    "them": "Pronomen",
    "in": "Präposition",
    "on": "Präposition",
    "at": "Präposition",
    "for": "Präposition",
    "from": "Präposition",
    "with": "Präposition",
    "without": "Präposition",
    "under": "Präposition",
    "over": "Präposition",
    "between": "Präposition",
}

PT_FUNCTION_WORDS = {
    "o": "Artikel",
    "a": "Artikel",
    "os": "Artikel",
    "as": "Artikel",
    "um": "Artikel",
    "uma": "Artikel",
    "e": "Konjunktion",
    "ou": "Konjunktion",
    "mas": "Konjunktion",
    "porque": "Konjunktion",
    "se": "Konjunktion",
    "eu": "Pronomen",
    "você": "Pronomen",
    "ele": "Pronomen",
    "ela": "Pronomen",
    "nós": "Pronomen",
    "eles": "Pronomen",
    "elas": "Pronomen",
    "em": "Präposition",
    "de": "Präposition",
    "para": "Präposition",
    "por": "Präposition",
    "com": "Präposition",
    "sem": "Präposition",
    "sobre": "Präposition",
    "entre": "Präposition",
}

TOPIC_KEYWORDS = {
    "Essen und Trinken": {
        "essen", "trinken", "wasser", "brot", "milch", "kaffee", "tee", "reis", "fleisch", "fisch", "obst", "gemüse", "küche",
    },
    "Familie und Menschen": {
        "familie", "mutter", "vater", "eltern", "kind", "sohn", "tochter", "bruder", "schwester", "freund", "frau", "mann",
    },
    "Körper und Gesundheit": {
        "körper", "kopf", "hand", "auge", "herz", "gesund", "krank", "arzt", "medizin", "schmerz", "krankenhaus",
    },
    "Wohnen und Haushalt": {
        "haus", "wohnung", "zimmer", "tür", "fenster", "tisch", "stuhl", "bett", "möbel", "haushalt", "garten",
    },
    "Reisen und Verkehr": {
        "reise", "reisen", "flug", "flughafen", "zug", "auto", "bus", "straße", "verkehr", "hotel", "urlaub",
    },
    "Arbeit und Bildung": {
        "arbeit", "arbeiten", "beruf", "firma", "büro", "schule", "lernen", "lehrer", "universität", "studium", "buch",
    },
    "Zeit und Kalender": {
        "zeit", "tag", "woche", "monat", "jahr", "heute", "morgen", "gestern", "stunde", "minute", "uhr",
    },
    "Natur und Umwelt": {
        "natur", "baum", "blume", "tier", "hund", "katze", "meer", "fluss", "berg", "wetter", "regen", "sonne",
    },
    "Gefühle und Eigenschaften": {
        "liebe", "glück", "angst", "freude", "traurig", "glücklich", "wütend", "schön", "gut", "schlecht",
    },
    "Kommunikation": {
        "sprechen", "sagen", "fragen", "antwort", "sprache", "wort", "brief", "telefon", "nachricht", "gespräch",
    },
    "Gesellschaft": {
        "gesellschaft", "staat", "regierung", "gesetz", "politik", "recht", "wirtschaft", "kultur", "geschichte", "religion",
    },
}

BLOCKED_WORDS = {
    "fuck", "fucking", "shit", "bitch", "asshole",
    "caralho", "porra", "merda", "puta", "viado",
    "ain", "aren", "couldn", "d", "didn", "doesn", "don", "hadn", "hasn", "haven",
    "im", "isn", "ll", "m", "re", "s", "shouldn", "t", "ve", "wasn", "weren", "won", "wouldn",
}

PORTUGUESE_NON_LEMMA_FORMS = {
    "ao", "aos", "da", "das", "do", "dos", "na", "nas", "no", "nos", "pela", "pelas", "pelo", "pelos",
    "era", "eram", "está", "estão", "estava", "estavam", "foi", "foram", "fui", "são", "será", "seria",
    "amo", "boa", "deve", "diz", "disse", "espera", "fez", "olha", "pode", "posso", "quer", "sabe", "sei", "tem", "tenho", "teve", "tinha", "vai", "vamos", "veio", "viu", "vou",
}

PORTUGUESE_LEVEL_OVERRIDES = {
    **dict.fromkeys(
        {
            "água", "ano", "amanhã", "amigo", "banana", "beber", "bom", "branco", "café", "casa", "comer",
            "comida", "comprar", "criança", "dar", "dia", "dizer", "dormir", "escrever", "estar", "falar", "família",
            "feliz", "fechar", "filha", "filho", "fruta", "gostar", "grande", "homem", "hoje", "hora", "irmã", "irmão",
            "ir", "laranja", "leite", "ler", "mãe", "mau", "mulher", "não", "nome", "noite", "novo", "número", "ouvir",
            "pagar", "pai", "pão", "peixe", "pequeno", "poder", "porta", "preto", "querer", "saber", "semana", "ser",
            "tempo", "ter", "tomar", "trabalhar", "velho", "ver", "verde", "vermelho", "vida", "viver", "azul", "abrir",
            "aprender", "arroz", "carne", "maçã", "mês",
        },
        "A1",
    ),
    **dict.fromkeys(
        {
            "aeroporto", "batata", "cabeça", "carro", "cebola", "cenoura", "cidade", "colher", "corpo", "copo", "dinheiro",
            "escola", "faca", "garfo", "hotel", "hospital", "loja", "mão", "mercado", "médico", "morango", "natal", "ônibus",
            "pé", "prato", "roupa", "rua", "saúde", "tomate", "trabalho", "trem", "viagem",
        },
        "A2",
    ),
}

TRANSLATION_OVERRIDES = {
    "en": {
        "you": "du",
        "i": "ich",
        "the": "der/die/das",
        "to": "zu",
        "a": "ein/eine",
        "it": "es",
        "and": "und",
        "that": "das/dass",
        "of": "von",
        "is": "ist",
        "in": "in",
        "what": "was",
        "we": "wir",
        "me": "mich",
        "this": "dies/diese",
        "he": "er",
        "for": "für",
        "my": "mein/meine",
        "on": "auf",
        "have": "haben",
        "your": "dein/deine",
        "do": "tun/machen",
        "was": "war",
        "no": "nein/kein",
        "not": "nicht",
        "be": "sein",
        "are": "sind",
        "know": "wissen/kennen",
        "can": "können",
        "with": "mit",
        "but": "aber",
        "all": "alle/alles",
        "just": "nur/gerade",
        "from": "von/aus",
        "they": "sie",
        "will": "werden",
        "one": "eins/einer",
        "would": "würde",
        "there": "dort/da",
        "their": "ihr/ihre",
        "get": "bekommen",
        "go": "gehen",
        "make": "machen",
        "like": "mögen/wie",
        "say": "sagen",
        "see": "sehen",
        "come": "kommen",
        "think": "denken",
        "want": "wollen",
        "look": "schauen/aussehen",
    },
    "pt-BR": {
        "que": "dass/was",
        "não": "nicht/nein",
        "o": "der/das",
        "de": "von/aus",
        "a": "die/zu",
        "é": "ist",
        "você": "du/Sie",
        "e": "und",
        "um": "ein/eins",
        "para": "für/nach",
        "está": "ist/befindet sich",
        "uma": "eine",
        "se": "wenn/sich",
        "com": "mit",
        "por": "durch/für",
        "ele": "er",
        "isso": "das",
        "em": "in",
        "mas": "aber",
        "como": "wie",
        "bem": "gut",
        "no": "im/am",
        "os": "die",
        "ela": "sie",
        "sim": "ja",
        "mais": "mehr",
        "meu": "mein",
        "seu": "dein/Ihr",
        "muito": "sehr/viel",
        "as": "die",
        "sua": "deine/Ihre",
        "tudo": "alles",
        "minha": "meine",
        "só": "nur",
        "então": "dann",
        "agora": "jetzt",
        "ser": "sein",
        "quando": "wann/wenn",
        "aqui": "hier",
        "nós": "wir",
        "eu": "ich",
        "vai": "geht/wird",
        "fazer": "machen",
        "ter": "haben",
        "ir": "gehen",
        "dizer": "sagen",
        "ver": "sehen",
        "saber": "wissen",
        "querer": "wollen",
        "poder": "können",
    },
}


def download(url: str, destination: Path) -> None:
    if destination.exists():
        return

    print(f"Downloading {url}")
    urllib.request.urlretrieve(url, destination)


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFC", value.strip().lower())
    return "".join(character for character in value if character.isalpha() or character in "'-")


def clean_word(value: str) -> str:
    value = " ".join(value.split()).strip(" \t\r\n!?.,:;()[]{}<>/\\|\"“”„…")
    if " " in value or not value or len(value) > 40:
        return ""

    if not all(character.isalpha() or character in "'-" for character in value):
        return ""

    return value


def clean_translation(value: str) -> str:
    value = " ".join(value.split())
    value = re.sub(r"\s*\([^)]{0,45}\)\s*", " ", value)
    value = " ".join(value.split()).strip(" ;,/")
    if not value or len(value) > 64 or not any(character.isalpha() for character in value):
        return ""
    return value


def frequency_rank(value: str, ranks: dict[str, int]) -> int:
    normalized = normalize(value)
    if normalized in ranks:
        return ranks[normalized]

    token_ranks = [ranks.get(normalize(token), 1_000_000) for token in value.split()]
    return min(token_ranks, default=1_000_000) + 100_000


def candidate_score(headword: str, translation: str, german_ranks: dict[str, int]) -> tuple[int, int, int, int]:
    return (
        1 if headword[:1].isupper() and len(headword) > 1 else 0,
        frequency_rank(translation, german_ranks),
        translation.count(" "),
        len(translation),
    )


def read_dictionary(path: Path, german_ranks: dict[str, int]) -> dict[str, tuple[str, str, str]]:
    entries: dict[str, tuple[str, str, str]] = {}
    scores: dict[str, tuple[int, int, int, int]] = {}

    for _, element in ET.iterparse(path, events=("end",)):
        if element.tag != f"{TEI_NAMESPACE}entry":
            continue

        orth = element.find(f"./{TEI_NAMESPACE}form/{TEI_NAMESPACE}orth")
        raw_headword = "".join(orth.itertext()) if orth is not None else ""
        headword = clean_word(raw_headword)
        key = normalize(headword)

        if not key:
            element.clear()
            continue

        translations = []
        for quote in element.findall(f".//{TEI_NAMESPACE}cit[@type='trans']/{TEI_NAMESPACE}quote"):
            translation = clean_translation("".join(quote.itertext()))
            if translation:
                translations.append(translation)

        if not translations:
            element.clear()
            continue

        translation = min(
            translations,
            key=lambda item: (frequency_rank(item, german_ranks), item.count(" "), len(item)),
        )
        pos_element = element.find(f".//{TEI_NAMESPACE}pos")
        raw_pos = "".join(pos_element.itertext()).strip().lower() if pos_element is not None else ""
        score = candidate_score(headword, translation, german_ranks)

        if key not in scores or score < scores[key]:
            entries[key] = (headword, translation, raw_pos)
            scores[key] = score

        element.clear()

    return entries


def read_dictionary_translation_sets(path: Path) -> dict[str, list[str]]:
    entries: dict[str, set[str]] = {}

    for _, element in ET.iterparse(path, events=("end",)):
        if element.tag != f"{TEI_NAMESPACE}entry":
            continue

        orth = element.find(f"./{TEI_NAMESPACE}form/{TEI_NAMESPACE}orth")
        raw_headword = "".join(orth.itertext()) if orth is not None else ""
        headword = clean_word(raw_headword)
        key = normalize(headword)

        if key:
            for quote in element.findall(f".//{TEI_NAMESPACE}cit[@type='trans']/{TEI_NAMESPACE}quote"):
                translation = clean_translation("".join(quote.itertext()))
                if translation:
                    entries.setdefault(key, set()).add(translation)

        element.clear()

    return {key: sorted(translations) for key, translations in entries.items()}


def read_frequency_list(path: Path) -> list[tuple[str, int]]:
    rows: list[tuple[str, int]] = []

    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            word, count = line.rsplit(" ", 1)
        except ValueError:
            continue

        clean = clean_word(word)
        if clean and normalize(clean) not in BLOCKED_WORDS:
            rows.append((clean, int(count)))

    return rows


def build_frequency_ranks(rows: list[tuple[str, int]]) -> dict[str, int]:
    return {normalize(word): index for index, (word, _) in enumerate(rows)}


def map_penn_part_of_speech(tag: str) -> str:
    if tag.startswith("NN"):
        return "Nomen"
    if tag.startswith("VB") or tag == "MD":
        return "Verb"
    if tag.startswith("JJ"):
        return "Adjektiv"
    if tag.startswith("RB"):
        return "Adverb"
    if tag.startswith("PRP") or tag.startswith("WP"):
        return "Pronomen"
    if tag == "IN" or tag == "TO":
        return "Präposition"
    if tag == "CC":
        return "Konjunktion"
    if tag == "DT" or tag == "PDT":
        return "Artikel"
    if tag == "CD":
        return "Zahlwort"
    if tag == "UH":
        return "Interjektion"
    return "Wort"


def read_english_cefr_lemmas(path: Path) -> dict[str, tuple[str, str, str, int]]:
    level_labels = ("A1", "A2", "B1", "B2", "C1", "C2")
    entries: dict[str, tuple[str, str, str, int]] = {}

    with sqlite3.connect(path) as connection:
        rows = connection.execute(
            """
            select
              coalesce(lemma.word, word.word) as lemma,
              pos.tag,
              word_pos.frequency_count,
              word_pos.level
            from word_pos
            join words as word on word.word_id = word_pos.word_id
            left join words as lemma on lemma.word_id = word_pos.lemma_word_id
            join pos_tags as pos on pos.tag_id = word_pos.pos_tag_id
            where word_pos.level is not null
            """
        )

        for raw_lemma, raw_pos, raw_frequency, raw_level in rows:
            lemma = clean_word(str(raw_lemma))
            key = normalize(lemma)

            if not key or key in BLOCKED_WORDS or raw_pos in {"NNP", "NNPS", "FW", "SYM"}:
                continue

            numeric_level = min(6, max(1, int(float(raw_level) + 0.5)))
            level = level_labels[numeric_level - 1]
            frequency = int(raw_frequency or 0)
            candidate = (lemma.lower(), level, map_penn_part_of_speech(str(raw_pos)), frequency)
            current = entries.get(key)

            if current is None or numeric_level < level_labels.index(current[1]) + 1:
                entries[key] = candidate
            elif current[1] == level and frequency > current[3]:
                entries[key] = candidate

    return entries


def infer_part_of_speech(language: str, lemma: str, translation: str, raw_pos: str) -> str:
    normalized = lemma.lower()
    function_words = EN_FUNCTION_WORDS if language == "en" else PT_FUNCTION_WORDS

    if normalized in function_words:
        return function_words[normalized]

    if raw_pos in POS_MAP:
        return POS_MAP[raw_pos]

    if translation[:1].isupper():
        return "Nomen"

    if language == "pt-BR":
        if normalized.endswith("mente"):
            return "Adverb"
        if normalized.endswith(("ar", "er", "ir")):
            return "Verb"
    else:
        if normalized.endswith("ly"):
            return "Adverb"
        if normalized.endswith(("ize", "ise", "ify")):
            return "Verb"
        if normalized.endswith(("able", "ible", "ful", "less", "ous", "ive")):
            return "Adjektiv"

    return "Wort"


def infer_topic(lemma: str, translation: str) -> str:
    tokens = {normalize(token) for token in re.split(r"[^\wäöüÄÖÜß'-]+", f"{lemma} {translation}") if token}

    for topic, keywords in TOPIC_KEYWORDS.items():
        if tokens.intersection({normalize(keyword) for keyword in keywords}):
            return topic

    return "Allgemein"


def select_level_quotas(
    language: str,
    candidates: dict[str, list[tuple[str, str, str, str, int, str]]],
) -> list[tuple[str, str, str, str, int, str]]:
    selected: list[tuple[str, str, str, str, int, str]] = []
    level_sizes = PORTUGUESE_LEVEL_SIZES if language == "pt-BR" else LEVEL_SIZES

    for level, target_size in level_sizes:
        level_candidates = sorted(
            candidates.get(level, []),
            key=lambda item: (
                language == "pt-BR" and normalize(item[0]) in PORTUGUESE_LEVEL_OVERRIDES,
                item[4],
            ),
            reverse=True,
        )
        if len(level_candidates) < target_size:
            available = {item_level: len(items) for item_level, items in candidates.items()}
            raise RuntimeError(
                f"{language}: {level} needs {target_size} entries, only {len(level_candidates)} available; {available}"
            )
        selected.extend(level_candidates[:target_size])

    return selected


def format_reference_rows(selected: list[tuple[str, str, str, str, int, str]]) -> list[list[object]]:
    maximum_count = max(item[4] for item in selected)
    minimum_count = min(item[4] for item in selected)
    log_range = math.log(maximum_count + 1) - math.log(minimum_count + 1)
    result: list[list[object]] = []

    for lemma, translation, part_of_speech, level, count, translation_source in selected:
        frequency_score = (math.log(count + 1) - math.log(minimum_count + 1)) / log_range if log_range else 1
        result.append(
            [
                lemma,
                translation,
                part_of_speech,
                level,
                infer_topic(lemma, translation),
                round(frequency_score, 4),
                translation_source,
            ]
        )

    return result


def build_english_reference(
    dictionary: dict[str, tuple[str, str, str]],
    cefr_lemmas: dict[str, tuple[str, str, str, int]],
) -> list[list[object]]:
    candidates: dict[str, list[tuple[str, str, str, str, int, str]]] = {}

    for key, (lemma, level, part_of_speech, frequency) in cefr_lemmas.items():
        dictionary_entry = dictionary.get(key)
        if not dictionary_entry:
            continue

        _, dictionary_translation, _ = dictionary_entry
        curated_translation = TRANSLATION_OVERRIDES["en"].get(key)
        translation = curated_translation or dictionary_translation
        translation_source = "curated" if curated_translation else "dictionary"
        display_lemma = "I" if key == "i" else lemma
        candidates.setdefault(level, []).append(
            (display_lemma, translation, part_of_speech, level, frequency, translation_source)
        )

    return format_reference_rows(select_level_quotas("en", candidates))


def match_english_cefr(
    translations: list[str],
    cefr_lemmas: dict[str, tuple[str, str, str, int]],
) -> tuple[str, str] | None:
    matches: list[tuple[str, str, str, int]] = []

    for translation in translations:
        words = [normalize(item) for item in re.split(r"[^\w'-]+", translation) if item]
        matches.extend(cefr_lemmas[word] for word in words if word and word != "to" and word in cefr_lemmas)

    if not matches:
        return None

    level_order = {level: index for index, (level, _) in enumerate(LEVEL_SIZES)}
    _, level, part_of_speech, _ = min(matches, key=lambda item: (level_order[item[1]], -item[3]))
    return level, part_of_speech


def build_portuguese_reference(
    german_dictionary: dict[str, tuple[str, str, str]],
    english_dictionary: dict[str, list[str]],
    cefr_lemmas: dict[str, tuple[str, str, str, int]],
    frequencies: list[tuple[str, int]],
) -> list[list[object]]:
    candidates: dict[str, list[tuple[str, str, str, str, int, str]]] = {}
    seen: set[str] = set()

    for frequency_word, count in frequencies:
        key = normalize(frequency_word)
        if key in seen or key in PORTUGUESE_NON_LEMMA_FORMS:
            continue

        german_entry = german_dictionary.get(key)
        english_entry = english_dictionary.get(key)
        level_override = PORTUGUESE_LEVEL_OVERRIDES.get(key)

        if not german_entry or (not english_entry and not level_override):
            continue

        if german_entry[0][:1].isupper() and not level_override:
            continue

        cefr_match = match_english_cefr(english_entry, cefr_lemmas) if english_entry else None
        if not cefr_match and not level_override:
            continue

        mapped_level, english_part_of_speech = cefr_match or ("A1", "Wort")
        level = level_override or mapped_level
        _, dictionary_translation, raw_pos = german_entry
        curated_translation = TRANSLATION_OVERRIDES["pt-BR"].get(key)
        translation = curated_translation or dictionary_translation
        translation_source = "curated" if curated_translation else "dictionary"
        inferred_part_of_speech = infer_part_of_speech("pt-BR", frequency_word, translation, raw_pos)
        part_of_speech = english_part_of_speech if inferred_part_of_speech == "Wort" else inferred_part_of_speech
        candidates.setdefault(level, []).append(
            (frequency_word.lower(), translation, part_of_speech, level, count, translation_source)
        )
        seen.add(key)

    target_c1_size = dict(PORTUGUESE_LEVEL_SIZES)["C1"]
    current_c1 = candidates.get("C1", [])
    current_c2 = sorted(candidates.get("C2", []), key=lambda item: item[4], reverse=True)
    promote_count = max(target_c1_size - len(current_c1), 0)

    if promote_count:
        promoted = [
            (lemma, translation, part_of_speech, "C1", count, translation_source)
            for lemma, translation, part_of_speech, _, count, translation_source in current_c2[:promote_count]
        ]
        candidates["C1"] = current_c1 + promoted
        candidates["C2"] = current_c2[promote_count:]

    return format_reference_rows(select_level_quotas("pt-BR", candidates))


def main() -> None:
    payload: dict[str, object] = {
        "generatedAt": GENERATED_AT,
        "versions": {language: config["version"] for language, config in SOURCES.items()},
        "sources": [
            {
                "name": "Words-CEFR-Dataset",
                "url": "https://github.com/Maximax67/Words-CEFR-Dataset",
                "license": "MIT",
                "purpose": "English lemma and CEFR classification basis",
            },
            {
                "name": "FrequencyWords 2018",
                "url": "https://github.com/hermitdave/FrequencyWords",
                "license": "MIT",
                "purpose": "Brazilian Portuguese frequency ordering and dictionary sense ranking",
            },
            {
                "name": "FreeDict",
                "url": "https://freedict.org/",
                "license": "dictionary-specific GPL/AGPL terms; see docs/reference-lexicon.md",
                "purpose": "German translations and Portuguese-to-English level mapping",
            },
        ],
        "levelSizes": {
            "en": {level: size for level, size in LEVEL_SIZES},
            "pt-BR": {level: size for level, size in PORTUGUESE_LEVEL_SIZES},
        },
        "languages": {},
    }

    with tempfile.TemporaryDirectory(prefix="sprachapp-reference-") as temporary_directory:
        temporary = Path(temporary_directory)
        german_frequency_file = temporary / "de-frequency.txt"
        portuguese_frequency_file = temporary / "pt-BR-frequency.txt"
        cefr_database_file = temporary / "word-cefr.db"
        download(GERMAN_FREQUENCY_URL, german_frequency_file)
        download(SOURCES["pt-BR"]["frequency"], portuguese_frequency_file)
        download(CEFR_DATABASE_URL, cefr_database_file)
        german_ranks = build_frequency_ranks(read_frequency_list(german_frequency_file))
        portuguese_frequencies = read_frequency_list(portuguese_frequency_file)
        cefr_lemmas = read_english_cefr_lemmas(cefr_database_file)

        archive_configs = [
            SOURCES["en"],
            SOURCES["pt-BR"],
            {
                "dictionary": PORTUGUESE_ENGLISH_DICTIONARY["url"],
                "archive": PORTUGUESE_ENGLISH_DICTIONARY["archive"],
                "tei": PORTUGUESE_ENGLISH_DICTIONARY["tei"],
            },
        ]

        for config in archive_configs:
            archive = temporary / config["archive"]
            download(config["dictionary"], archive)
            with tarfile.open(archive, "r:xz") as source_archive:
                source_archive.extractall(temporary, filter="data")

        english_german_dictionary = read_dictionary(temporary / SOURCES["en"]["tei"], german_ranks)
        portuguese_german_dictionary = read_dictionary(temporary / SOURCES["pt-BR"]["tei"], german_ranks)
        portuguese_english_dictionary = read_dictionary_translation_sets(
            temporary / PORTUGUESE_ENGLISH_DICTIONARY["tei"]
        )

        payload["languages"]["en"] = build_english_reference(english_german_dictionary, cefr_lemmas)
        payload["languages"]["pt-BR"] = build_portuguese_reference(
            portuguese_german_dictionary,
            portuguese_english_dictionary,
            cefr_lemmas,
            portuguese_frequencies,
        )

        for language in ("en", "pt-BR"):
            rows = payload["languages"][language]
            level_sizes = PORTUGUESE_LEVEL_SIZES if language == "pt-BR" else LEVEL_SIZES
            counts = {level: sum(1 for row in rows if row[3] == level) for level, _ in level_sizes}
            print(f"{language}: {len(rows)} entries {counts}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
