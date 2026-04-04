export const GET_AXIES_BY_OWNER = `
  query GetAxiesByOwner($owner: String!, $from: Int, $size: Int) {
    axies(auctionType: All, owner: $owner, from: $from, size: $size) {
      total
      results {
        id
        name
        class
        newGenes
        breedCount
        stage
        parts {
          id
          name
          class
          type
        }
        stats {
          hp
          speed
          skill
          morale
        }
      }
    }
  }
`;

export const GET_AXIE_DETAIL = `
  query GetAxieDetail($axieId: ID!) {
    axie(axieId: $axieId) {
      id
      name
      class
      newGenes
      breedCount
      stage
      owner
      parts {
        id
        name
        class
        type
      }
      stats {
        hp
        speed
        skill
        morale
      }
    }
  }
`;
