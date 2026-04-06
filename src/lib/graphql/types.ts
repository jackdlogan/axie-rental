export interface AxiePart {
  id: string;
  name: string;
  class: string;
  type: string;
}

export interface AxieStats {
  hp: number;
  speed: number;
  skill: number;
  morale: number;
}

export interface Axie {
  id: string;
  name: string;
  class: string;
  newGenes: string;
  breedCount: number;
  stage: number;
  owner?: string;
  parts: AxiePart[];
  stats: AxieStats;
  fortuneSlips?: { total: number; potentialAmount: number };
}

export interface AxiesResponse {
  axies: {
    total: number;
    results: Axie[];
  };
}

export interface AxieDetailResponse {
  axie: Axie;
}
