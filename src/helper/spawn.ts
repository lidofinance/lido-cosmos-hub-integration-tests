import lasset from "./lido_helper";
import {Fee, Validator, Wallet} from "@terra-money/terra.js";
import {execute} from "./flow/execution";
import {Testkit, TestkitInit} from "../testkit/testkit";

// https://terra-money.quip.com/lR4sAHcX3yiB/WebApp-Dev-Page-Deployment#UKCACAa6MDK
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
    };
}

export default class Lido {
    public lAsset: lasset;
    private owner: Wallet;

    constructor(owner: Wallet) {
        this.owner = owner;
        this.lAsset = new lasset();
    }

    public async store_contracts_localterra(
        lassetLocation: string,
        fee?: Fee
    ): Promise<void> {
        await this.lAsset.storeCodes(this.owner, lassetLocation, fee);
    }

    public async store_contracts(
        lassetLocation: string,
        fee?: Fee
    ): Promise<void> {
        await this.lAsset.storeCodes(this.owner, lassetLocation, fee);
    }

    public async instantiate_localterra(
        fee?: Fee,
        params?: CustomInstantiationParam,
        validators_addresses?: Array<string>,
    ): Promise<void> {
        await this.lAsset.instantiate_hub(this.owner, params?.lasset, fee);
        await this.lAsset.instantiate_validators_registry(this.owner, {
            hub_contract: this.lAsset.contractInfo.lido_terra_hub.contractAddress,
            registry: validators_addresses.map((val) => {
                return {active: true, total_delegated: "100", address: val}
            })
        }, fee);
        await this.lAsset.instantiate_st_atom(this.owner, {}, fee);
        await this.lAsset.instantiate_lido_terra_rewards_dispatcher(this.owner, {
            lido_fee_address: params.lasset.lido_fee_address,
        }, fee)

        await this.lAsset.register_contracts(this.owner, {}, fee);
    }

    public async instantiate(
        fee?: Fee,
        params?: CustomInstantiationParam,
        validators?: Array<TestkitInit.Validator>,
    ): Promise<void> {

        await this.lAsset.instantiate_hub(this.owner, params?.lasset, fee);
        await this.lAsset.instantiate_validators_registry(this.owner, {
            hub_contract: this.lAsset.contractInfo.lido_terra_hub.contractAddress,
            registry: validators.map((val) => {
                return {active: true, total_delegated: "100", address: val.validator_address}
            })
        }, fee);
        await this.lAsset.instantiate_st_atom(this.owner, {}, fee);
        await this.lAsset.instantiate_lido_terra_rewards_dispatcher(this.owner, {
            lido_fee_address: params.lasset.lido_fee_address,
        }, fee)

        await this.lAsset.register_contracts(this.owner, {}, fee);
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
