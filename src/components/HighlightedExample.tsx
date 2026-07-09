function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface HighlightedExampleProps {
  sentence: string;
  term: string;
}

export function HighlightedExample({ sentence, term }: HighlightedExampleProps) {
  if (!term.trim()) {
    return <span>{sentence}</span>;
  }

  const chunks = sentence.split(new RegExp(`(${escapeRegExp(term.trim())})`, "gi"));

  return (
    <span>
      {chunks.map((chunk, index) =>
        chunk.toLowerCase() === term.trim().toLowerCase() ? (
          <mark key={`${chunk}-${index}`}>{chunk}</mark>
        ) : (
          <span key={`${chunk}-${index}`}>{chunk}</span>
        ),
      )}
    </span>
  );
}
