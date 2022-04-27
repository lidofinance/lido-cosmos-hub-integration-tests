import { DeliverTxResponse } from "@cosmjs/stargate";

export const getResponseAttributes = (
  response: DeliverTxResponse,
  event: string
): Record<string, any> => {
  const [data] = JSON.parse(response.rawLog);
  return data.events
    .find((e) => e.type === event)
    .attributes.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
};
