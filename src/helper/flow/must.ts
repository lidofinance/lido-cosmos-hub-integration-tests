export const mustPass = <T>(action: Promise<T>): Promise<T> =>
  action
    .then((r) => r)
    .catch((e) => {
      throw new Error(`Action failed w/ msg ${e}, ${e.data}`);
    });

export function floateq(a: number, b: number, e: number): boolean {
  return Math.abs((a - b) / (a + b)) < e;
}

export const mustFail = <T>(p: Promise<T>): Promise<Error> =>
  p.then(
    (r) => {
      throw new Error(`Action should have failed but succeeded ${r}`);
    },
    () => null,
  );

export const mustFailWithErrorMsg = <T>(
  p: Promise<T>,
  errorMsg: string,
): Promise<Error> =>
  p.then(
    (r) => {
      throw new Error(`Action should have failed but succeeded ${r}`);
    },
    (reason) => {
      if (!reason.message.toString().includes(errorMsg)) {
        throw new Error(`Action failed with invalid error ${reason}`);
      }
      return null;
    },
  );
