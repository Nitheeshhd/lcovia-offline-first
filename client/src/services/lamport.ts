let lamportCounter = 0;

export const lamport = {
  tick(): number {
    lamportCounter += 1;
    return lamportCounter;
  },

  update(incoming: number): number {
    lamportCounter = Math.max(lamportCounter, incoming) + 1;
    return lamportCounter;
  },

  current(): number {
    return lamportCounter;
  },
};