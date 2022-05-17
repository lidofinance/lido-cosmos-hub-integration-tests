import { CustomInstantiationParam } from '../helper/spawn';
import { atomDenom } from './../helper/types/coin';

export const setTestParams = (
  validator: string,
  testAccount: string,
  lido_fee_address?: string,
): CustomInstantiationParam => {
  const testParams: CustomInstantiationParam = {
    testAccount: testAccount,
    lasset: {
      epoch_period: 10,
      underlying_coin_denom: atomDenom,
      unbonding_period: 10,
      peg_recovery_fee: '0.001',
      er_threshold: '1.0',
      max_burn_ratio: '0.1',
      reward_denom: atomDenom,
      validator,
      lido_fee_address: lido_fee_address,
    },
  };
  return testParams;
};
