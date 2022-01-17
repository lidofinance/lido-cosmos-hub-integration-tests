import basset from "./basset_helper";
import {Fee, Validator, Wallet} from "@terra-money/terra.js";
import {execute} from "./flow/execution";
import {Testkit, TestkitInit} from "../testkit/testkit";

// https://terra-money.quip.com/lR4sAHcX3yiB/WebApp-Dev-Page-Deployment#UKCACAa6MDK
export interface CustomInstantiationParam {
    testAccount: string;
    basset?: {
        epoch_period?: number;
        unbonding_period?: number;
        underlying_coin_denom?: string;
        peg_recovery_fee?: string;
        er_threshold?: string;
        reward_denom?: string;
        validator?: string;
        lido_fee_address?: string;
    };
}

export default class Anchor {
    public bAsset: basset;
    private owner: Wallet;

    constructor(owner: Wallet) {
        this.owner = owner;
        this.bAsset = new basset();
    }

    public async store_contracts_localterra(
        bassetLocation: string,
        fee?: Fee
    ): Promise<void> {
        await this.bAsset.storeCodes(this.owner, bassetLocation, fee);
    }

    public async store_contracts(
        bassetLocation: string,
        mmLocation: string,
        terraswapLocation: string,
        ancLocation: string,
        fee?: Fee
    ): Promise<void> {
        await this.bAsset.storeCodes(this.owner, bassetLocation, fee);
    }

    public async instantiate_localterra(
        fee?: Fee,
        params?: CustomInstantiationParam,
        validators_addresses?: Array<string>,
    ): Promise<void> {
        await this.bAsset.instantiate_hub(this.owner, params?.basset, fee);
        await this.bAsset.instantiate_validators_registry(this.owner, {
            hub_contract: this.bAsset.contractInfo.lido_terra_hub.contractAddress,
            registry: validators_addresses.map((val) => {
                return {active: true, total_delegated: "100", address: val}
            })
        }, fee);
        await this.bAsset.instantiate_st_luna(this.owner, {}, fee);
        await this.bAsset.instantiate_lido_terra_rewards_dispatcher(this.owner, {
            lido_fee_address: params.basset.lido_fee_address,
        }, fee)

        await this.bAsset.register_contracts(this.owner, {}, fee);
    }

    public async instantiate(
        fee?: Fee,
        params?: CustomInstantiationParam,
        validators?: Array<TestkitInit.Validator>,
    ): Promise<void> {

        await this.bAsset.instantiate_hub(this.owner, params?.basset, fee);
        await this.bAsset.instantiate_validators_registry(this.owner, {
            hub_contract: this.bAsset.contractInfo.lido_terra_hub.contractAddress,
            registry: validators.map((val) => {
                return {active: true, total_delegated: "100", address: val.validator_address}
            })
        }, fee);
        await this.bAsset.instantiate_st_luna(this.owner, {}, fee);
        await this.bAsset.instantiate_lido_terra_rewards_dispatcher(this.owner, {
            lido_fee_address: params.basset.lido_fee_address,
        }, fee)

        await this.bAsset.register_contracts(this.owner, {}, fee);
    }
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
