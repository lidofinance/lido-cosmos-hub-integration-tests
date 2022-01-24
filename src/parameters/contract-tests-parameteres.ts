import { CustomInstantiationParam } from "../helper/spawn";
import { ValAddress } from "@terra-money/terra.js";

export const setTestParams = (
  validator: ValAddress,
  testAccount: string,
  lido_fee_address?: string,
): CustomInstantiationParam => {
  let testParams: CustomInstantiationParam = {
    testAccount: testAccount,
    lasset: {
      epoch_period: 10,
      underlying_coin_denom: "uluna",
      unbonding_period: 10,
      peg_recovery_fee: "0.001",
      er_threshold: "1.0",
      reward_denom: "uusd",
      validator: validator, // for tequila
      lido_fee_address: lido_fee_address,
    },
  };
  return testParams;
};
