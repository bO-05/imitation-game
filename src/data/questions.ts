/**
 * questions.ts — the interrogation deck.
 * Tappable cards (mobile-first). Each costs daylight. The art of the game
 * is spending the sun where it cuts.
 */
export type QuestionId = "origin" | "light" | "sleep" | "shadow" | "festival" | "press";

export interface QuestionCard {
  id: QuestionId;
  label: string;     // short label on the card
  text: string;      // what the examiner asks
  costHours: number; // daylight cost
  hint: string;      // what this question tends to expose
}

export const DECK: QuestionCard[] = [
  {
    id: "origin",
    label: "ORIGIN",
    text: "State your city, and tell me one true thing about living there.",
    costHours: 1.0,
    hint: "Baseline. Voice, texture, specifics.",
  },
  {
    id: "light",
    label: "THE LIGHT",
    text: "Describe the light there, this week.",
    costHours: 1.5,
    hint: "Check against: day length, sunset time & bearing, midnight sky.",
  },
  {
    id: "sleep",
    label: "SLEEP",
    text: "How are you sleeping, this time of year?",
    costHours: 1.5,
    hint: "Midnight sun & white nights leave marks on people.",
  },
  {
    id: "shadow",
    label: "NOON SHADOW",
    text: "You step outside at noon. Which way does your shadow fall?",
    costHours: 2.0,
    hint: "Hemisphere test. Check the ledger's shadow line.",
  },
  {
    id: "festival",
    label: "CALENDAR",
    text: "What does your city celebrate this month?",
    costHours: 2.0,
    hint: "Festivals have dates. The ledger keeps them.",
  },
  {
    id: "press",
    label: "PRESS",
    text: "(Press them on their last answer.)",
    costHours: 1.0,
    hint: "A second pull on the same thread.",
  },
];

export const QUESTION_BY_ID = Object.fromEntries(DECK.map((q) => [q.id, q])) as Record<QuestionId, QuestionCard>;
