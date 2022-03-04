/**
 * Wait for a given number of ms
 * @param ms milliseconds to wait
 * @returns
 */
export const wait = async (ms: number): Promise<void> => {
  return new Promise((resolve, _) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};
