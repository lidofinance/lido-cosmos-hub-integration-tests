/**
 * Wait for a given number of ms
 * @param ms milliseconds to wait
 * @returns
 */
export const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
