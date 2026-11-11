export type MovieFact = {
  id: string;
  movie: string;
  text: string;
  createdAt: string;
};

export type FactResult = {
  fact: MovieFact;
  source: "generated" | "cached" | "stale";
};
