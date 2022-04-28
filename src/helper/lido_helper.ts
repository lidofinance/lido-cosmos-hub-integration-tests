import * as fs from 'fs';
import { execute, instantiate, send_transaction } from './flow/execution';
import { atomDenom } from './types/coin';
import {
  Coin,
  DirectSecp256k1HdWallet,
  EncodeObject,
} from '@cosmjs/proto-signing';
import {
  coins,
  DeliverTxResponse,
  makeMultisignedTx,
  MsgDelegateEncodeObject,
  SignerData,
} from '@cosmjs/stargate';
import {
  MsgExecuteContractEncodeObject,
  MsgStoreCodeEncodeObject,
} from '@cosmjs/cosmwasm-stargate';
import { CustomInstantiationParam } from '../helper/spawn';
import { assertIsDeliverTxSuccess } from '@cosmjs/stargate';
import {
  MsgExecuteContract,
  MsgStoreCode,
} from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { getResponseAttributes } from './flow/response';
import { CosmosWrapper, getSignedClient } from '../testcases/cosmos';
import { MultisigThresholdPubkey, StdFee } from '@cosmjs/amino';
import { pubkeyToAddress } from '@cosmjs/amino';
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { toAscii } from '@cosmjs/encoding';
import { mnemonicToWallet, sleep } from '../testcases/common_localcosmosnet';
import {
  MsgDelegate,
  MsgUndelegate,
} from 'cosmjs-types/cosmos/staking/v1beta1/tx';
import { get_redelegations } from './redelegations';

export enum CONTRACT {
  LIDO_COSMOS_HUB = 'lido_cosmos_hub',
  LIDO_COSMOS_TOKEN_STATOM = 'lido_cosmos_token_statom',
  LIDO_COSMOS_REWARDS_DISPATCHER = 'lido_cosmos_rewards_dispatcher',
  LIDO_COSMOS_VALIDATORS_REGISTRY = 'lido_cosmos_validators_registry',
  LIDO_COSMOS_AIRDROP_REGISTRY = 'lido_cosmos_airdrop_registry',
}

const contracts = [
  CONTRACT.LIDO_COSMOS_HUB,
  CONTRACT.LIDO_COSMOS_TOKEN_STATOM,
  CONTRACT.LIDO_COSMOS_REWARDS_DISPATCHER,
  CONTRACT.LIDO_COSMOS_VALIDATORS_REGISTRY,
];

type Expire =
  | { at_height: number }
  | { at_time: number }
  | { never: Record<string, never> };

type CustomInstantiationParamLasset = CustomInstantiationParam['lasset'];

type SigningInstruction = {
  accountNumber: number;
  sequence: number;
  chainId: string;
  msgs: EncodeObject[];
  fee: StdFee;
  memo: string;
};

const defaultFee = {
  amount: coins(250000, 'stake'),
  gas: '89000000',
};

export default class LidoAsset {
  wrapper: CosmosWrapper;
  public contractInfo: Partial<
    Record<CONTRACT, { codeId: number; contractAddress: string }>
  >;

  constructor(wrapper: CosmosWrapper) {
    this.contractInfo = {};
    this.wrapper = wrapper;
  }

  public async storeCodes(
    sender: DirectSecp256k1HdWallet,
    location: string,
  ): Promise<void> {
    return contracts.reduce(
      (t, c) =>
        t.then(async () => {
          const bytecode = fs.readFileSync(`${location}/${c}.wasm`);
          const address = (await sender.getAccounts())[0].address;
          const msgStoreCode = MsgStoreCode.fromPartial({
            sender: address,
            wasmByteCode: bytecode,
          });
          const msgAny: MsgStoreCodeEncodeObject = {
            typeUrl: '/cosmwasm.wasm.v1.MsgStoreCode',
            value: msgStoreCode,
          };
          const fee = {
            amount: coins(3000000, 'stake'),
            gas: '10000000',
          };
          console.log('sending store code message', address);
          const client = await await getSignedClient(sender);
          const result = await client.signAndBroadcast(address, [msgAny], fee);
          console.log('store code message sent');
          assertIsDeliverTxSuccess(result);
          console.log('store code message confirmed');
          const attributes = getResponseAttributes(result, 'store_code');
          this.contractInfo[c] = {
            codeId: +attributes.code_id,
            contractAddress: '',
          };
        }),
      Promise.resolve(),
    );
  }

  public async instantiate_validators_registry(
    sender: DirectSecp256k1HdWallet,
    params: {
      registry?: Array<{
        active: boolean;
        total_delegated?: string;
        address: string;
      }>;
      hub_contract: string;
    },
  ): Promise<void> {
    const init = await instantiate(
      sender,
      this.contractInfo.lido_cosmos_validators_registry.codeId,
      {
        registry: params.registry || [],
        hub_contract:
          params.hub_contract ||
          this.contractInfo.lido_cosmos_hub.contractAddress,
      },
      undefined,
      defaultFee,
    );

    assertIsDeliverTxSuccess(init);

    const attributes = getResponseAttributes(init, 'instantiate');
    const contractAddress = attributes._contract_address;
    this.contractInfo.lido_cosmos_validators_registry.contractAddress =
      contractAddress;

    console.log(
      `lido_cosmos_validators_registry: { codeId: ${this.contractInfo.lido_cosmos_validators_registry.codeId}, contractAddress: "${this.contractInfo.lido_cosmos_validators_registry.contractAddress}"},`,
    );
  }

  public async instantiate_st_atom(
    sender: DirectSecp256k1HdWallet,
    params: {
      name?: string;
      symbol?: string;
      decimals?: number;
      initial_balances?: [];
      mint?: null;
      hub_contract?: string;
    },
  ): Promise<void> {
    const init = await instantiate(
      sender,
      this.contractInfo.lido_cosmos_token_statom.codeId,
      {
        name: params.name || 'test_name',
        symbol: params.symbol || 'AAA',
        decimals: params.decimals || 6,
        initial_balances: params.initial_balances || [],
        hub_contract:
          params.hub_contract ||
          this.contractInfo.lido_cosmos_hub.contractAddress,
        mint: params.mint,
      },
      undefined,
      defaultFee,
    );

    assertIsDeliverTxSuccess(init);

    const attributes = getResponseAttributes(init, 'instantiate');
    const contractAddress = attributes._contract_address;
    this.contractInfo.lido_cosmos_token_statom.contractAddress =
      contractAddress;

    console.log(
      `lido_cosmos_token_statom: { codeId: ${this.contractInfo.lido_cosmos_token_statom.codeId}, contractAddress: "${this.contractInfo.lido_cosmos_token_statom.contractAddress}"},`,
    );
  }

  public async instantiate_lido_cosmos_rewards_dispatcher(
    sender: DirectSecp256k1HdWallet,
    params: {
      hub_contract?: string;
      lido_fee_address?: string;
      lido_fee_rate?: string;
    },
  ): Promise<void> {
    const init = await instantiate(
      sender,
      this.contractInfo.lido_cosmos_rewards_dispatcher.codeId,
      {
        hub_contract:
          params.hub_contract ||
          this.contractInfo.lido_cosmos_hub.contractAddress,
        statom_reward_denom: atomDenom,
        //FIX: change to real fee address?
        lido_fee_address:
          params.lido_fee_address ||
          this.contractInfo.lido_cosmos_token_statom.contractAddress,
        lido_fee_rate: params.lido_fee_rate || '0.005',
      },
      undefined,
      defaultFee,
    );

    assertIsDeliverTxSuccess(init);

    const attributes = getResponseAttributes(init, 'instantiate');
    const contractAddress = attributes._contract_address;

    this.contractInfo.lido_cosmos_rewards_dispatcher.contractAddress =
      contractAddress;

    console.log(
      `lido_cosmos_rewards_dispatcher: { codeId: ${this.contractInfo.lido_cosmos_rewards_dispatcher.codeId}, contractAddress: "${this.contractInfo.lido_cosmos_rewards_dispatcher.contractAddress}"},`,
    );
  }

  public async instantiate_hub(
    sender: DirectSecp256k1HdWallet,
    params: CustomInstantiationParamLasset,
  ): Promise<void> {
    const init = await instantiate(
      sender,
      this.contractInfo.lido_cosmos_hub.codeId,
      params,
      undefined,
      defaultFee,
    );

    assertIsDeliverTxSuccess(init);

    const attributes = getResponseAttributes(init, 'instantiate');
    const contractAddress = attributes._contract_address;
    this.contractInfo.lido_cosmos_hub.contractAddress = contractAddress;
    console.log(
      `lido_cosmos_hub: { codeId: ${this.contractInfo.lido_cosmos_hub.codeId}, contractAddress: "${this.contractInfo.lido_cosmos_hub.contractAddress}"},`,
    );
  }

  public async register_contracts(
    sender: DirectSecp256k1HdWallet,
    params: {
      reward_address?: string;
      validators_registry?: string;
      rewards_dispatcher_contract?: string;
      statom_token_contract?: string;
    },
  ) {
    const msg = await execute(
      sender,
      this.contractInfo['lido_cosmos_hub'].contractAddress,
      {
        update_config: {
          owner: undefined,
          rewards_dispatcher_contract:
            params.rewards_dispatcher_contract ||
            `${this.contractInfo['lido_cosmos_rewards_dispatcher'].contractAddress}`,
          statom_token_contract:
            params.statom_token_contract ||
            `${this.contractInfo['lido_cosmos_token_statom'].contractAddress}`,
          validators_registry_contract:
            params.validators_registry ||
            `${this.contractInfo.lido_cosmos_validators_registry.contractAddress}`,
        },
      },
      undefined,
      defaultFee,
    );
    assertIsDeliverTxSuccess(msg);
  }

  //   public async register_validator(
  //     sender: Wallet,
  //     validator: string,
  //     fee?: Fee
  //   ): Promise<void> {
  //     const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
  //     const registerValidatorExecution = await execute(
  //       sender,
  //       contract,
  //       {
  //         register_validator: {
  //           validator: `${validator}`,
  //         },
  //       },
  //       undefined,
  //       fee
  //     );
  //     if (isTxError(registerValidatorExecution)) {
  //       throw new Error(`Couldn't run: ${registerValidatorExecution.raw_log}`);
  //     }
  //   }

  public async add_validator(
    sender: DirectSecp256k1HdWallet,
    validatorAddress: string,
  ): Promise<DeliverTxResponse> {
    const contract =
      this.contractInfo.lido_cosmos_validators_registry.contractAddress;
    const addValidatorExecution = await execute(
      sender,
      contract,
      {
        add_validator: {
          validator: {
            address: `${validatorAddress}`,
            active: true,
          },
        },
      },
      undefined,
      { amount: [{ amount: '75000', denom: 'stake' }], gas: '300000' },
    );
    assertIsDeliverTxSuccess(addValidatorExecution);
    return addValidatorExecution;
  }

  //   public async remove_validator(
  //     sender: Wallet,
  //     validatorAddress: string
  //   ): Promise<void> {
  //     const contract = this.contractInfo.lido_cosmos_validators_registry
  //       .contractAddress;
  //     const removeValidatorExecution = await execute(sender, contract, {
  //       remove_validator: {
  //         address: `${validatorAddress}`,
  //       },
  //     });
  //     if (isTxError(removeValidatorExecution)) {
  //       throw new Error(`Couldn't run: ${removeValidatorExecution.raw_log}`);
  //     }
  //   }

  public async bond_for_statom(
    sender: DirectSecp256k1HdWallet,
    amount: number,
  ): Promise<DeliverTxResponse> {
    const coin: Coin = { denom: atomDenom, amount: amount.toString() };
    const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
    const bondExecution = await execute(
      sender,
      contract,
      {
        bond_for_st_atom: {},
      },
      [coin],
      { amount: [{ amount: '250000', denom: 'stake' }], gas: '1000000' },
    );
    assertIsDeliverTxSuccess(bondExecution);
    return bondExecution;
  }

  public async delegate_to_validator(
    sender: DirectSecp256k1HdWallet,
    validator: string,
    amount: number,
  ): Promise<DeliverTxResponse> {
    const msg = MsgDelegate.fromPartial({
      delegatorAddress: (await sender.getAccounts())[0].address,
      validatorAddress: validator,
      amount: { denom: atomDenom, amount: amount.toString() },
    });
    const msgAny = {
      typeUrl: '/liquidstaking.staking.v1beta1.MsgDelegate',
      value: msg,
    };
    const tx = await send_transaction(sender, [msgAny], {
      amount: [{ amount: '2500', denom: 'stake' }],
      gas: '400000',
    });
    assertIsDeliverTxSuccess(tx);
    return tx;
  }

  public async undelegate_from_validator(
    sender: DirectSecp256k1HdWallet,
    validator: string,
    amount: number,
  ): Promise<DeliverTxResponse> {
    const msg = MsgUndelegate.fromPartial({
      delegatorAddress: (await sender.getAccounts())[0].address,
      validatorAddress: validator,
      amount: { denom: atomDenom, amount: amount.toString() },
    });
    const msgAny = {
      typeUrl: '/liquidstaking.staking.v1beta1.MsgUndelegate',
      value: msg,
    };
    const tx = await send_transaction(sender, [msgAny], {
      amount: [{ amount: '250000', denom: 'stake' }],
      gas: '1000000',
    });
    assertIsDeliverTxSuccess(tx);
    return tx;
  }

  public async bond_tokenized_share(
    sender: DirectSecp256k1HdWallet,
    amount: number,
  ): Promise<DeliverTxResponse> {
    const coin: Coin = { denom: atomDenom, amount: amount.toString() };
    const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
    const bondExecution = await execute(
      sender,
      contract,
      {
        receive: {},
      },
      [coin],
      { amount: [{ amount: '250000', denom: 'stake' }], gas: '1000000' },
    );
    assertIsDeliverTxSuccess(bondExecution);
    return bondExecution;
  }

  public async redelegate_proxy(
    sender: DirectSecp256k1HdWallet,
    src_validator_address: string,
    redelegations: Array<[string, { amount: string; denom: string }]>,
  ): Promise<DeliverTxResponse> {
    const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
    const bondExecution = await execute(
      sender,
      contract,
      {
        redelegate_proxy: {
          src_validator: src_validator_address,
          redelegations: redelegations.map(([dst_addr, coin]) => [
            dst_addr,
            { amount: `${coin.amount}`, denom: coin.denom },
          ]),
        },
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
    );
    assertIsDeliverTxSuccess(bondExecution);
    return bondExecution;
  }

  //   public async params(
  //     sender: Wallet,
  //     params: {
  //       epoch_period?: number;
  //       underlying_coin_denom?: string;
  //       unbonding_period?: number;
  //       peg_recovery_fee?: string;
  //       er_threshold?: string;
  //       reward_denom?: string;
  //     },
  //     fee?: Fee
  //   ): Promise<void> {
  //     const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
  //     const paramsExecution = await execute(
  //       sender,
  //       contract,
  //       {
  //         update_params: {
  //           epoch_period: params?.epoch_period || 30,
  //           underlying_coin_denom: params?.underlying_coin_denom || atomDenom,
  //           unbonding_period: params?.unbonding_period || 211,
  //           peg_recovery_fee: params?.peg_recovery_fee || "0.001",
  //           er_threshold: params?.er_threshold || "1",
  //           reward_denom: params?.reward_denom || "uusd",
  //         },
  //       },
  //       undefined,
  //       fee
  //     );
  //     if (isTxError(paramsExecution)) {
  //       throw new Error(`Couldn't run: ${paramsExecution.raw_log}`);
  //     }
  //   }

  public async update_config(
    sender: DirectSecp256k1HdWallet,
    owner?: string,
    token_contract?: string,
  ): Promise<DeliverTxResponse> {
    const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
    const paramsExecution = await execute(
      sender,
      contract,
      {
        update_config: {
          owner,
          token_contract: token_contract,
        },
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
    );
    assertIsDeliverTxSuccess(paramsExecution);
    return paramsExecution;
  }

  public async receive_tokenized_share(
    sender: DirectSecp256k1HdWallet,
    share: Coin,
  ): Promise<DeliverTxResponse> {
    const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
    const finishExecution = await execute(
      sender,
      contract,
      {
        receive_tokenized_share: {},
      },
      [share],
      { amount: [{ amount: '75000', denom: 'stake' }], gas: '1000000' },
    );
    assertIsDeliverTxSuccess(finishExecution);
    return finishExecution;
  }

  public async dispatch_rewards(
    sender: DirectSecp256k1HdWallet,
  ): Promise<DeliverTxResponse> {
    const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
    const finishExe = await execute(
      sender,
      contract,
      {
        dispatch_rewards: {
          // airdrop_hooks: null,
        },
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '1200000' },
    );
    assertIsDeliverTxSuccess(finishExe);
    return finishExe;
  }

  //   public async dispatch_rewards_with_result(
  //     sender: Wallet
  //   ): Promise<BlockTxBroadcastResult> {
  //     const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
  //     const finishExe = await execute(sender, contract, {
  //       dispatch_rewards: {
  //         // airdrop_hooks: null,
  //       },
  //     });
  //     if (isTxError(finishExe)) {
  //       throw new Error(`Couldn't run: ${finishExe.raw_log}`);
  //     }
  //     return finishExe;
  //   }

  //   public async slashing(sender: Wallet): Promise<void> {
  //     const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
  //     const slashingExe = await execute(sender, contract, {
  //       check_slashing: {},
  //     });
  //     if (isTxError(slashingExe)) {
  //       throw new Error(`Couldn't run: ${slashingExe.raw_log}`);
  //     }
  //   }

  public async mint_cw20_token(
    contract: string,
    sender: DirectSecp256k1HdWallet,
    recipient: string,
    amount: number,
  ): Promise<DeliverTxResponse> {
    const sendExecution = await execute(
      sender,
      contract,
      {
        mint: {
          recipient: recipient,
          amount: `${amount}`,
        },
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
    );
    assertIsDeliverTxSuccess(sendExecution);
    return sendExecution;
  }

  public async send_cw20_token(
    contract: string,
    sender: DirectSecp256k1HdWallet,
    amount: number,
    inputMsg: object,
    dstContractAddr: string,
  ): Promise<DeliverTxResponse> {
    const sendExecution = await execute(
      sender,
      contract,
      {
        send: {
          contract: dstContractAddr,
          amount: String(amount),
          msg: Buffer.from(JSON.stringify(inputMsg)).toString('base64'),
        },
      },
      undefined,
      { amount: [{ amount: '200000', denom: 'stake' }], gas: '2000000' },
    );
    assertIsDeliverTxSuccess(sendExecution);
    return sendExecution;
  }

  public async send_from_cw20_token(
    contract: string,
    sender: DirectSecp256k1HdWallet,
    owner: DirectSecp256k1HdWallet,
    amount: number,
    inputMsg: object,
    contracAddr: string,
  ): Promise<DeliverTxResponse> {
    const sendExecution = await execute(
      sender,
      contract,
      {
        send_from: {
          owner: (await owner.getAccounts())[0].address,
          contract: contracAddr,
          amount: `${amount}`,
          msg: Buffer.from(JSON.stringify(inputMsg)).toString('base64'),
        },
      },
      undefined,
      { amount: [{ amount: '200000', denom: 'stake' }], gas: '2000000' },
    );
    assertIsDeliverTxSuccess(sendExecution);
    return sendExecution;
  }

  public async transfer_cw20_token(
    contract: string,
    sender: DirectSecp256k1HdWallet,
    rcv: DirectSecp256k1HdWallet,
    amount: number,
  ): Promise<DeliverTxResponse> {
    const toAddress = (await rcv.getAccounts())[0].address;
    const transferExecution = await execute(
      sender,
      contract,
      {
        transfer: {
          recipient: toAddress,
          amount: `${amount}`,
        },
      },
      undefined,
      { amount: [{ amount: '75000', denom: 'stake' }], gas: '300000' },
    );
    assertIsDeliverTxSuccess(transferExecution);
    return transferExecution;
  }

  public async transfer_from_cw20_token(
    contract: string,
    sender: DirectSecp256k1HdWallet,
    owner: DirectSecp256k1HdWallet,
    receiver: DirectSecp256k1HdWallet,
    amount: number,
  ): Promise<DeliverTxResponse> {
    const transferExecution = await execute(
      sender,
      contract,
      {
        transfer_from: {
          owner: `${(await owner.getAccounts())[0].address}`,
          recipient: `${(await receiver.getAccounts())[0].address}`,
          amount: `${amount}`,
        },
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
    );
    assertIsDeliverTxSuccess(transferExecution);
    return transferExecution;
  }

  public async burn_cw20_token(
    contract: string,
    sender: DirectSecp256k1HdWallet,
    amount: number,
  ): Promise<DeliverTxResponse> {
    const transferExecution = await execute(
      sender,
      contract,
      {
        burn: {
          amount: `${amount}`,
        },
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
    );
    assertIsDeliverTxSuccess(transferExecution);
    return transferExecution;
  }

  public async burn_from_cw20_token(
    contract: string,
    sender: DirectSecp256k1HdWallet,
    owner: DirectSecp256k1HdWallet,
    amount: number,
  ): Promise<DeliverTxResponse> {
    const transferExecution = await execute(
      sender,
      contract,
      {
        burn_from: {
          owner: `${(await owner.getAccounts())[0].address}`,
          amount: `${amount}`,
        },
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
    );

    assertIsDeliverTxSuccess(transferExecution);
    return transferExecution;
  }

  public async increase_allowance(
    contract: string,
    sender: DirectSecp256k1HdWallet,
    spender: DirectSecp256k1HdWallet,
    amount: number,
    expire: Expire,
  ): Promise<DeliverTxResponse> {
    const execution = await execute(
      sender,
      contract,
      {
        increase_allowance: {
          spender: `${(await spender.getAccounts())[0].address}`,
          amount: `${amount}`,
          expires: expire,
        },
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
    );
    assertIsDeliverTxSuccess(execution);
    return execution;
  }

  public async decrease_allowance(
    contract: string,
    sender: DirectSecp256k1HdWallet,
    spender: DirectSecp256k1HdWallet,
    amount: number,
    expire: Expire,
  ): Promise<DeliverTxResponse> {
    const execution = await execute(
      sender,
      contract,
      {
        decrease_allowance: {
          spender: (await spender.getAccounts())[0].address,
          amount: `${amount}`,
          expires: expire,
        },
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
    );
    assertIsDeliverTxSuccess(execution);
    return execution;
  }

  //   public async add_airdrop_info(
  //     sender: Wallet,
  //     token: string,
  //     aidrop: string,
  //     pair: string
  //   ): Promise<void> {
  //     const execution = await execute(
  //       sender,
  //       this.contractInfo.lido_cosmos_airdrop_registry.contractAddress,
  //       {
  //         add_airdrop_info: {
  //           airdrop_token: "ANC",
  //           airdrop_info: {
  //             airdrop_token_contract: token,
  //             airdrop_contract: aidrop,
  //             airdrop_swap_contract: pair,
  //             swap_belief_price: null,
  //             swap_max_spread: null,
  //           },
  //         },
  //       }
  //     );
  //     if (isTxError(execution)) {
  //       throw new Error(`Couldn't run: ${execution.raw_log}`);
  //     }
  //   }

  //   public async bank_send(
  //     sender: Wallet,
  //     receiver: string,
  //     amount: Coins
  //   ): Promise<void> {
  //     const msg = await execute_bank(sender, amount, receiver);
  //     if (isTxError(msg)) {
  //       throw new Error(`Couldn't run: ${msg.raw_log}`);
  //     }
  //   }

  public async add_guardians(
    sender: DirectSecp256k1HdWallet,
    guardians: Array<string>,
  ): Promise<DeliverTxResponse> {
    const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
    const addGuardians = await execute(
      sender,
      contract,
      {
        add_guardians: { addresses: guardians },
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
    );
    try {
      assertIsDeliverTxSuccess(addGuardians);
    } catch (e) {
      console.log(
        e,
        'add guardians error: ',
        guardians,
        await sender.getAccounts(),
      );
      throw e;
    }
    return addGuardians;
  }

  public async remove_guardians(
    sender: DirectSecp256k1HdWallet,
    guardians: Array<string>,
  ): Promise<DeliverTxResponse> {
    const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
    const removeGuardians = await execute(
      sender,
      contract,
      {
        remove_guardians: { addresses: guardians },
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
    );
    assertIsDeliverTxSuccess(removeGuardians);
    return removeGuardians;
  }

  public async pause_contracts(
    sender: DirectSecp256k1HdWallet,
    duration: number,
  ): Promise<DeliverTxResponse> {
    const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
    const pauseContracts = await execute(
      sender,
      contract,
      {
        pause_contracts: {
          duration,
        },
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
    );
    assertIsDeliverTxSuccess(pauseContracts);
    return pauseContracts;
  }

  public async unpause_contracts(
    sender: DirectSecp256k1HdWallet,
  ): Promise<DeliverTxResponse> {
    const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
    const unpauseContracts = await execute(
      sender,
      contract,
      {
        unpause_contracts: {},
      },
      undefined,
      { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
    );
    assertIsDeliverTxSuccess(unpauseContracts);
    return unpauseContracts;
  }

  //   public async fabricate_mir_claim(
  //     sender: Wallet,
  //     stage: number,
  //     amount: string,
  //     proof: Array<string>
  //   ): Promise<void> {
  //     const execution = await execute(
  //       sender,
  //       this.contractInfo.lido_cosmos_airdrop_registry.contractAddress,
  //       {
  //         fabricate_mir_claim: {
  //           stage: stage,
  //           amount: amount,
  //           proof: proof,
  //         },
  //       }
  //     );
  //     if (isTxError(execution)) {
  //       throw new Error(`Couldn't run: ${execution.raw_log}`);
  //     }
  //   }
  // }

  // async function execute_bank(
  //   sender: Wallet,
  //   amount: Coins,
  //   to: string
  // ): ReturnType<typeof send_transaction> {
  //   return await send_transaction(sender, [
  //     new MsgSend(sender.key.accAddress, to, amount),
  //   ]);

  get_atom_balance = async (wallet: DirectSecp256k1HdWallet): Promise<number> =>
    Number(
      (
        await this.wrapper.queryClient.bank.balance(
          (
            await wallet.getAccounts()
          )[0].address,
          atomDenom,
        )
      ).amount,
    );

  incoming_redelegations_inprogress = async (
    hubContract: string,
    validators_address: Array<string>,
  ): Promise<Array<string>> => {
    const validators_incoming_redelegations: string[] = [];
    const { redelegationResponses } =
      await this.wrapper.queryClient.staking.redelegations(hubContract, '', '');

    for (const response of redelegationResponses) {
      if (
        response.redelegation &&
        validators_address.includes(response.redelegation.validatorDstAddress)
      ) {
        validators_incoming_redelegations.push(
          response.redelegation.validatorDstAddress,
        );
      }
    }
    return validators_incoming_redelegations;
  };

  redistribute = async (
    owner: DirectSecp256k1HdWallet,
    hubContract: string,
    validators: { validator: string; amount: number }[],
  ): Promise<boolean> => {
    const inprogress = await this.incoming_redelegations_inprogress(
      hubContract,
      validators.map((v) => v.validator),
    );
    console.log('inprogress', inprogress);
    const redelegations = get_redelegations(validators, inprogress);
    for (const r of redelegations) {
      await this.redelegate_proxy(owner, r.srcVal, [
        [r.dstVal, { amount: String(r.amount), denom: atomDenom }],
      ]);
    }
    return true;
  };

  redelegate_proxy_multisig = async (
    hubcontract: string,
    multisigPubkey: MultisigThresholdPubkey,
    mnemonics: Array<string>,
    srcValidatorAddress: string,
    redelegations: Array<[string, { amount: string; denom: string }]>,
  ): Promise<DeliverTxResponse> => {
    const multisigAddr = pubkeyToAddress(multisigPubkey, 'wasm');
    const accountOnChain = await this.wrapper.client.getAccount(multisigAddr);

    const msg: MsgExecuteContractEncodeObject = {
      typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
      value: MsgExecuteContract.fromPartial({
        contract: hubcontract,
        msg: toAscii(
          JSON.stringify({
            redelegate_proxy: {
              src_validator: srcValidatorAddress,
              redelegations: redelegations.map(([dst_addr, coin]) => [
                dst_addr,
                { amount: `${coin.amount}`, denom: coin.denom },
              ]),
            },
          }),
        ),
        funds: [],
      }),
    };

    const signingInstruction: SigningInstruction = {
      accountNumber: accountOnChain.accountNumber,
      sequence: accountOnChain.sequence,
      chainId: await this.wrapper.client.getChainId(),
      msgs: [msg],
      fee: { amount: [{ amount: '150000', denom: 'stake' }], gas: '600000' },
      memo: '',
    };

    const signedData = await Promise.all(
      mnemonics.map(this.signMultisigMsg(signingInstruction)),
    );

    const signatures = signedData.reduce((map, curr) => {
      map.set(curr.address, curr.signature);
      return map;
    }, new Map<string, Uint8Array>());

    const signedTx = makeMultisignedTx(
      multisigPubkey,
      signingInstruction.sequence,
      signingInstruction.fee,
      signedData[0].bodyBytes,
      signatures,
    );

    const result = await this.wrapper.client.broadcastTx(
      Uint8Array.from(TxRaw.encode(signedTx).finish()),
    );
    assertIsDeliverTxSuccess(result);
    return result;
  };

  signMultisigMsg =
    (signingInstruction: SigningInstruction) => async (mnemonic: string) => {
      const wallet = await mnemonicToWallet(mnemonic);
      const { pubkey, address } = (await wallet.getAccounts())[0];
      const signingClient = await getSignedClient(wallet);
      const signerData: SignerData = {
        accountNumber: signingInstruction.accountNumber,
        sequence: signingInstruction.sequence,
        chainId: signingInstruction.chainId,
      };
      const { bodyBytes, signatures } = await signingClient.sign(
        address,
        signingInstruction.msgs,
        signingInstruction.fee,
        signingInstruction.memo,
        signerData,
      );
      return { pubkey, address, signature: signatures[0], bodyBytes } as const;
    };
}
