/**
 * vignettes.ts — five fragments between the nights.
 * Turing's June-bound life, told in gate-stamp prose. All dates verified.
 */
export interface Vignette {
  afterNight: number; // shown after this night index (0-based); -1 = before night 1
  date: string;
  title: string;
  lines: string[];
}

export const VIGNETTES: Vignette[] = [
  {
    afterNight: -1,
    date: "23 June 1912",
    title: "MAIDA VALE, LONDON",
    lines: [
      "Two days after the solstice, in the year's long light, a child is born in Maida Vale.",
      "Alan Mathison Turing. The days have just begun, imperceptibly, to shorten.",
      "He will spend his life on one question wearing many costumes: how would you know?",
    ],
  },
  {
    afterNight: 0,
    date: "1936",
    title: "ON COMPUTABLE NUMBERS",
    lines: [
      "A paper, at twenty-three: any computation can be done by one simple imagined machine — a tape, a head, a table of rules.",
      "Every machine that will ever interrogate, imitate, or dream is already inside it.",
      "Including, in a sense you will shortly have to stamp a verdict on, the travelers at this Gate.",
    ],
  },
  {
    afterNight: 1,
    date: "1939–1945",
    title: "HUT 8, BLETCHLEY PARK",
    lines: [
      "The war's question is your question, industrialized: which signals are honest?",
      "Turing's bombes don't read minds. They hunt CONTRADICTIONS — a settings guess that forces a letter to encrypt to itself is impossible, and dies.",
      "Hold the impossible against the claim, and the claim confesses. You have been doing cryptanalysis all week. Your ciphertext is conversation. Your crib is the sky.",
    ],
  },
  {
    afterNight: 2,
    date: "1950",
    title: "THE IMITATION GAME",
    lines: [
      "'Can machines think?' — Turing calls the question too meaningless to deserve discussion, and replaces it:",
      "suppose an interrogator, by questions alone, must tell the human from the machine.",
      "He predicted the machines would get good at this. He did not say what the interrogator owes the ones who stop pretending.",
    ],
  },
  {
    afterNight: 3,
    date: "31 March 1952 — 7 June 1954",
    title: "REGINA v. TURING",
    lines: [
      "The man who taught machines to be questioned failed a test he never agreed to take: the one his country ran on what a man is allowed to love.",
      "Convicted of gross indecency. Sentenced to chemical castration. Security clearance revoked — the codebreaker now the suspect signal.",
      "He died two weeks before the solstice, 7 June 1954. The official apology arrived in 2009; the pardon in 2013. The almanac is unmoved: the days he did not see still lengthened to the 21st, and turned.",
    ],
  },
];
