import lasset from './lido_helper';
import { execute } from './flow/execution';
import { Testkit, TestkitInit } from '../testkit/testkit';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { SigningStargateClient } from '@cosmjs/stargate';
import { CosmosWrapper } from '../testcases/cosmos';

export interface CustomInstantiationParam {
  testAccount: string;
  lasset?: {
    epoch_period?: number;
    unbonding_period?: number;
    underlying_coin_denom?: string;
    peg_recovery_fee?: string;
    er_threshold?: string;
    reward_denom?: string;
    validator?: string;
    lido_fee_address?: string;
    max_burn_ratio?: string;
  };
}

export default class Lido {
  client: SigningStargateClient;
  public lAsset: lasset;
  private owner: DirectSecp256k1HdWallet;

  constructor(wrapper: CosmosWrapper, owner: DirectSecp256k1HdWallet) {
    this.owner = owner;
    this.lAsset = new lasset(wrapper);
  }

  public async store_contracts_localcosmos(
    lassetLocation: string,
  ): Promise<void> {
    await this.lAsset.storeCodes(this.owner, lassetLocation);
  }

  // public async store_contracts(
  //   lassetLocation: string,
  //   fee?: Fee
  // ): Promise<void> {
  //   await this.lAsset.storeCodes(this.owner, lassetLocation, fee);
  // }

  public async instantiate_localcosmos(
    params?: CustomInstantiationParam,
    validators_addresses?: Array<string>,
    additionalParams: any = {},
  ): Promise<void> {
    console.log('instantiate hub', params);
    await this.lAsset.instantiate_hub(this.owner, params?.lasset);
    console.log('instantiate validator registry');
    await this.lAsset.instantiate_validators_registry(this.owner, {
      hub_contract: this.lAsset.contractInfo.lido_cosmos_hub.contractAddress,
      registry: validators_addresses.map((val) => ({
        active: true,
        total_delegated: '100',
        address: val,
      })),
    });
    console.log('instantiate token');
    await this.lAsset.instantiate_st_atom(this.owner, {});
    console.log('instantiate dispatcher');
    await this.lAsset.instantiate_lido_cosmos_rewards_dispatcher(this.owner, {
      lido_fee_address: params.lasset.lido_fee_address,
      ...additionalParams,
    });

    await this.lAsset.register_contracts(this.owner, {});
  }

  // public async instantiate(
  //   fee?: Fee,
  //   params?: CustomInstantiationParam,
  //   validators?: Array<TestkitInit.Validator>
  // ): Promise<void> {
  //   await this.lAsset.instantiate_hub(this.owner, params?.lasset, fee);
  //   await this.lAsset.instantiate_validators_registry(
  //     this.owner,
  //     {
  //       hub_contract: this.lAsset.contractInfo.lido_cosmos_hub.contractAddress,
  //       registry: validators.map((val) => {
  //         return {
  //           active: true,
  //           total_delegated: "100",
  //           address: val.validator_address,
  //         };
  //       }),
  //     },
  //     fee
  //   );
  //   await this.lAsset.instantiate_st_atom(this.owner, {}, fee);
  //   await this.lAsset.instantiate_lido_cosmos_rewards_dispatcher(
  //     this.owner,
  //     {
  //       lido_fee_address: params.lasset.lido_fee_address,
  //     },
  //     fee
  //   );

  //   await this.lAsset.register_contracts(this.owner, {}, fee);
  // }
}

export class Asset {
  public info: AccessInfo;
  public amount: string;

  constructor(tokenContractAddr: string, ntokenDenom: string, amount: string) {
    this.info = new AccessInfo(tokenContractAddr, ntokenDenom);
    this.amount = amount;
  }
}

class AccessInfo {
  Token: Token;
  NativeToken: NativeToken;

  constructor(contractAddr: string, ntokenDenom: string) {
    this.Token = new Token(contractAddr);
    this.NativeToken = new NativeToken(ntokenDenom);
  }
}

class Token {
  public contrctAddr: string;

  constructor(contracAddr: string) {
    this.contrctAddr = contracAddr;
  }
}

class NativeToken {
  public denom: string;

  constructor(denom: string) {
    this.denom = denom;
  }
}
