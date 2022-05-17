import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { assertIsDeliverTxSuccess } from '@cosmjs/stargate';
import { MsgUnjail } from 'cosmjs-types/cosmos/slashing/v1beta1/tx';
import { send_transaction } from '../flow/execution';

export const unjail = async (
  validatorAddr: string,
  validatorWallet: DirectSecp256k1HdWallet,
) => {
  const msg = {
    typeUrl: '/liquidstaking.slashing.v1beta1.MsgUnjail',
    value: MsgUnjail.fromPartial({
      validatorAddr,
    }),
  };

  const res = await send_transaction(validatorWallet, [msg], {
    amount: [{ amount: '150000', denom: 'stake' }],
    gas: '600000',
  });

  assertIsDeliverTxSuccess(res);
  return res;
};
