import {
  coins,
  DirectSecp256k1HdWallet,
  EncodeObject,
} from '@cosmjs/proto-signing';
import { Coin, StdFee, DeliverTxResponse } from '@cosmjs/stargate';
import { toAscii } from '@cosmjs/encoding';
import {
  MsgExecuteContractEncodeObject,
  MsgInstantiateContractEncodeObject,
} from '@cosmjs/cosmwasm-stargate';
import {
  MsgInstantiateContract,
  MsgExecuteContract,
} from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { getSignedClient } from '../../testcases/cosmos';

export async function instantiate(
  sender: DirectSecp256k1HdWallet,
  codeId: number,
  initMsg: object,
  tokens?: Coin[],
  fee?: StdFee,
): Promise<DeliverTxResponse> {
  console.info(`instantiate ${codeId} w/ ${JSON.stringify(initMsg)}`);
  const client = await getSignedClient(sender);
  const address = (await sender.getAccounts())[0].address;

  const theMsg: MsgInstantiateContractEncodeObject = {
    typeUrl: '/cosmwasm.wasm.v1.MsgInstantiateContract',
    value: MsgInstantiateContract.fromPartial({
      sender: address,
      codeId: codeId,
      label: 'my escrow',
      msg: toAscii(JSON.stringify(initMsg)),
      funds: tokens ? [...tokens] : [],
    }),
  };

  return client.signAndBroadcast(address, [theMsg], fee);
}

export async function execute(
  sender: DirectSecp256k1HdWallet,
  contract: string,
  executeMsg: object,
  tokens?: Coin[],
  fee: StdFee | 'auto' = 'auto',
): ReturnType<typeof send_transaction> {
  console.info(`execute ${contract} w/ ${JSON.stringify(executeMsg)}`, fee);

  const theMsg: MsgExecuteContractEncodeObject = {
    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
    value: MsgExecuteContract.fromPartial({
      sender: (await sender.getAccounts())[0].address,
      contract,
      msg: toAscii(JSON.stringify(executeMsg)),
      funds: tokens ? [...tokens] : [],
    }),
  };

  return send_transaction(sender, [theMsg], fee);
}

// const mantleStateForBlockResponse = new MantleState(
//   null,
//   [],
//   [],
//   testkit.deriveMantle()
// );

export async function send_transaction(
  sender: DirectSecp256k1HdWallet,
  msgs: EncodeObject[],
  fee: StdFee | 'auto' = {
    amount: coins(5000000, 'ustake'),
    gas: '89000000',
  },
): Promise<DeliverTxResponse> {
  const client = await getSignedClient(sender);
  const address = (await sender.getAccounts())[0].address;
  return client.signAndBroadcast(address, msgs, fee);
}
