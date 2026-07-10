const categoryLabels: Record<string, string> = {
  Ausdruecke: "Ausdrücke",
  Gefuehle: "Gefühle",
  Gemuese: "Gemüse",
  Koerper: "Körper",
  Moebel: "Möbel",
  Praepositionen: "Präpositionen",
};

export function formatCategoryLabel(value: string) {
  return categoryLabels[value] ?? value;
}
