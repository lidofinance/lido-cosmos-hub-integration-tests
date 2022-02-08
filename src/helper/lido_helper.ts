import {
    Coin,
    Coins,
    isTxError,
    MsgSend,
    MsgStoreCode,
    Fee,
    Wallet,
} from "@terra-money/terra.js";
import * as fs from "fs";
import {execute, instantiate, send_transaction} from "./flow/execution";
import { atomDenom } from "./types/coin";

const contracts = [
    "lido_cosmos_hub",
    "lido_cosmos_token_statom",
    "lido_cosmos_rewards_dispatcher",
    "lido_cosmos_validators_registry",
];

type Expire = {at_height: number} | {at_time: number} | {never: {}};

export default class LidoAsset {
    public contractInfo: {
        [contractName: string]: {codeId: number; contractAddress: string};
    };

    constructor() {
        this.contractInfo = {};
    }

    public async storeCodes(
        sender: Wallet,
        location: string,
        fee?: Fee
    ): Promise<void> {
        return contracts.reduce(
            (t, c) =>
                t.then(async () => {
                    const bytecode = fs.readFileSync(`${location}/${c}.wasm`);
                    const storeCode = new MsgStoreCode(
                        sender.key.accAddress,
                        bytecode.toString("base64")
                    );

                    const result = await send_transaction(sender, [storeCode], fee);
                    if (isTxError(result)) {
                        throw new Error(`Couldn't upload ${c}: ${result.raw_log}`);
                    }

                    const codeId = +result.logs[0].eventsByType.store_code.code_id[0];
                    this.contractInfo[c] = {
                        codeId,
                        contractAddress: "",
                    };
                }),
            Promise.resolve()
        );
    }

    public async instantiate_validators_registry(
        sender: Wallet,
        params: {
            registry?: Array<{active: boolean, total_delegated?: string, address: string}>,
            hub_contract: string,
        },
        fee?: Fee,
    ): Promise<void> {
        const init = await instantiate(
            sender,
            this.contractInfo.lido_cosmos_validators_registry.codeId,
            {
                registry: params.registry || [],
                hub_contract: params.hub_contract || this.contractInfo.lido_cosmos_hub.contractAddress
            },
            undefined
        )
        if (isTxError(init)) {
            throw new Error(`Couldn't instantiate: ${init.raw_log}`);
        }
        const contractAddress =
            init.logs[0].eventsByType.instantiate_contract.contract_address[0];
        this.contractInfo.lido_cosmos_validators_registry.contractAddress = contractAddress;

        console.log(
            `lido_cosmos_validators_registry: { codeId: ${this.contractInfo.lido_cosmos_validators_registry.codeId}, contractAddress: "${this.contractInfo.lido_cosmos_validators_registry.contractAddress}"},`
        );
    }

    public async instantiate_st_atom(
        sender: Wallet,
        params: {
            name?: string,
            symbol?: string,
            decimals?: number,
            initial_balances?: [],
            mint?: null,
            hub_contract?: string,
        },
        fee?: Fee,
    ): Promise<void> {
        const init = await instantiate(
            sender,
            this.contractInfo.lido_cosmos_token_statom.codeId,
            {
                name: params.name || "test_name",
                symbol: params.symbol || "AAA",
                decimals: params.decimals || 6,
                initial_balances: params.initial_balances || [],
                hub_contract: params.hub_contract || this.contractInfo.lido_cosmos_hub.contractAddress,
                mint: params.mint
            },
            undefined
        )
        if (isTxError(init)) {
            throw new Error(`Couldn't instantiate: ${init.raw_log}`);
        }
        const contractAddress =
            init.logs[0].eventsByType.instantiate_contract.contract_address[0];
        this.contractInfo.lido_cosmos_token_statom.contractAddress = contractAddress;

        console.log(
            `lido_cosmos_token_statom: { codeId: ${this.contractInfo.lido_cosmos_token_statom.codeId}, contractAddress: "${this.contractInfo.lido_cosmos_token_statom.contractAddress}"},`
        );
    }

    public async instantiate_lido_cosmos_rewards_dispatcher(
        sender: Wallet,
        params: {
            hub_contract?: string,
            lido_fee_address?: string,
        },
        fee?: Fee,
    ): Promise<void> {
        const init = await instantiate(
            sender,
            this.contractInfo.lido_cosmos_rewards_dispatcher.codeId,
            {
                hub_contract: params.hub_contract || this.contractInfo.lido_cosmos_hub.contractAddress,
                statom_reward_denom: atomDenom,
                //FIX: change to real fee address?
                lido_fee_address: params.lido_fee_address || this.contractInfo["lido_cosmos_token"].contractAddress,
                lido_fee_rate: "0.005",
            },
            undefined
        )
        if (isTxError(init)) {
            throw new Error(`Couldn't instantiate: ${init.raw_log}`);
        }
        const contractAddress =
            init.logs[0].eventsByType.instantiate_contract.contract_address[0];
        this.contractInfo.lido_cosmos_rewards_dispatcher.contractAddress = contractAddress;

        console.log(
            `lido_cosmos_rewards_dispatcher: { codeId: ${this.contractInfo.lido_cosmos_rewards_dispatcher.codeId}, contractAddress: "${this.contractInfo.lido_cosmos_rewards_dispatcher.contractAddress}"},`
        );

    }

    public async instantiate_hub(
        sender: Wallet,
        params: {
            epoch_period?: number;
            underlying_coin_denom?: string;
            unbonding_period?: number;
            peg_recovery_fee?: string;
            er_threshold?: string;
            reward_denom?: string;
            validator?: string;
        },
        fee?: Fee
    ): Promise<void> {
        const coins = new Coins([]);
        const init = await instantiate(
            sender,
            this.contractInfo.lido_cosmos_hub.codeId,
            {
                //FIXME: The epoch period and unbonding period must be changed
                epoch_period: params?.epoch_period,
                underlying_coin_denom: params?.underlying_coin_denom,
                unbonding_period: params?.unbonding_period,
                peg_recovery_fee: params?.peg_recovery_fee,
                er_threshold: params?.er_threshold,
                reward_denom: params?.reward_denom,
                validator: params?.validator,
            },
            coins,
            fee
        );
        if (isTxError(init)) {
            throw new Error(`Couldn't instantiate: ${init.raw_log}`);
        }

        const contractAddress =
            init.logs[0].eventsByType.instantiate_contract.contract_address[0];
        this.contractInfo.lido_cosmos_hub.contractAddress = contractAddress;

        console.log(
            `lido_cosmos_hub: { codeId: ${this.contractInfo.lido_cosmos_hub.codeId}, contractAddress: "${this.contractInfo.lido_cosmos_hub.contractAddress}"},`
        );
    }

    public async register_contracts(
        sender: Wallet,
        params: {
            reward_address?: string;
            validators_registry?: string;
            rewards_dispatcher_contract?: string;
            statom_token_contract?: string,
        },
        fee?: Fee
    ) {
        const msg = await execute(
            sender,
            this.contractInfo["lido_cosmos_hub"].contractAddress,
            {
                update_config: {
                    owner: undefined,
                    rewards_dispatcher_contract: params.rewards_dispatcher_contract || `${this.contractInfo["lido_cosmos_rewards_dispatcher"].contractAddress}`,
                    statom_token_contract: params.statom_token_contract || `${this.contractInfo["lido_cosmos_token_statom"].contractAddress}`,
                    validators_registry_contract: params.validators_registry || `${this.contractInfo.lido_cosmos_validators_registry.contractAddress}`,
                },
            },
            undefined,
            fee
        );
        if (isTxError(msg)) {
            throw new Error(`Couldn't run: ${msg.raw_log}`);
        }
    }

    public async register_validator(
        sender: Wallet,
        validator: string,
        fee?: Fee
    ): Promise<void> {
        const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
        const registerValidatorExecution = await execute(
            sender,
            contract,
            {
                register_validator: {
                    validator: `${validator}`,
                },
            },
            undefined,
            fee
        );
        if (isTxError(registerValidatorExecution)) {
            throw new Error(`Couldn't run: ${registerValidatorExecution.raw_log}`);
        }
    }

    public async add_validator(
        sender: Wallet,
        validatorAddress: string
    ): Promise<void> {
        const contract = this.contractInfo.lido_cosmos_validators_registry.contractAddress;
        const addValidatorExecution = await execute(sender, contract, {
            add_validator: {
                validator: {
                    address: `${validatorAddress}`,
                    active: true,
                }
            },
        });
        if (isTxError(addValidatorExecution)) {
            throw new Error(`Couldn't run: ${addValidatorExecution.raw_log}`);
        }
    }

    public async remove_validator(
        sender: Wallet,
        validatorAddress: string
    ): Promise<void> {
        const contract = this.contractInfo.lido_cosmos_validators_registry.contractAddress;
        const removeValidatorExecution = await execute(sender, contract, {
            remove_validator: {
                address: `${validatorAddress}`,
            },
        });
        if (isTxError(removeValidatorExecution)) {
            throw new Error(`Couldn't run: ${removeValidatorExecution.raw_log}`);
        }
    }

    public async bond_for_statom(
        sender: Wallet,
        amount: number,
    ): Promise<void> {
        const coin = new Coin(atomDenom, amount);
        const coins = new Coins([coin]);
        const contract = this.contractInfo["lido_cosmos_hub"].contractAddress;
        const bondExecution = await execute(
            sender,
            contract,
            {
                bond_for_st_atom: {},
            },
            coins
        );
        if (isTxError(bondExecution)) {
            throw new Error(`Couldn't run: ${bondExecution.raw_log}`);
        }
    }

    public async redelegate_proxy(
        sender: Wallet,
        src_validator_address: string,
        redelegations: Array<[string, Coin]>,
    ): Promise<void> {
        const contract = this.contractInfo["lido_cosmos_hub"].contractAddress;
        const bondExecution = await execute(
            sender,
            contract,
            {
                redelegate_proxy: {
                    src_validator: src_validator_address,
                    redelegations: redelegations.map(([dst_addr, coin]) => {return [dst_addr, {amount: `${coin.amount}`, denom: coin.denom}]}),
                },
            },
            undefined
        );
        if (isTxError(bondExecution)) {
            throw new Error(`Couldn't run: ${bondExecution.raw_log}`);
        }
    }

    public async params(
        sender: Wallet,
        params: {
            epoch_period?: number;
            underlying_coin_denom?: string;
            unbonding_period?: number;
            peg_recovery_fee?: string;
            er_threshold?: string;
            reward_denom?: string;
        },
        fee?: Fee
    ): Promise<void> {
        const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
        const paramsExecution = await execute(
            sender,
            contract,
            {
                update_params: {
                    epoch_period: params?.epoch_period || 30,
                    underlying_coin_denom: params?.underlying_coin_denom || atomDenom,
                    unbonding_period: params?.unbonding_period || 211,
                    peg_recovery_fee: params?.peg_recovery_fee || "0.001",
                    er_threshold: params?.er_threshold || "1",
                    reward_denom: params?.reward_denom || "uusd",
                },
            },
            undefined,
            fee
        );
        if (isTxError(paramsExecution)) {
            throw new Error(`Couldn't run: ${paramsExecution.raw_log}`);
        }
    }

    public async update_config(
        sender: Wallet,
        owner?: string,
        token_contract?: string
    ): Promise<void> {
        const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
        const paramsExecution = await execute(sender, contract, {
            update_config: {
                owner: owner,
                token_contract: token_contract,
            },
        });
        if (isTxError(paramsExecution)) {
            throw new Error(`Couldn't run: ${paramsExecution.raw_log}`);
        }
    }

    public async finish(sender: Wallet): Promise<void> {
        const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
        const finishExecution = await execute(sender, contract, {
            withdraw_unbonded: {},
        });
        if (isTxError(finishExecution)) {
            throw new Error(`Couldn't run: ${finishExecution.raw_log}`);
        }
    }

    public async dispatch_rewards(sender: Wallet): Promise<void> {
        const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
        const finishExe = await execute(sender, contract, {
            dispatch_rewards: {
                // airdrop_hooks: null,
            },
        });
        if (isTxError(finishExe)) {
            throw new Error(`Couldn't run: ${finishExe.raw_log}`);
        }
    }

    public async slashing(sender: Wallet): Promise<void> {
        const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
        const slashingExe = await execute(sender, contract, {
            check_slashing: {},
        });
        if (isTxError(slashingExe)) {
            throw new Error(`Couldn't run: ${slashingExe.raw_log}`);
        }
    }

    public async mint_cw20_token(
        contract: string,
        sender: Wallet,
        recipient: string,
        amount: number
    ): Promise<void> {
        const sendExecution = await execute(sender, contract, {
            mint: {
                recipient: recipient,
                amount: `${amount}`,
            },
        });
        if (isTxError(sendExecution)) {
            throw new Error(`Couldn't run: ${sendExecution.raw_log}`);
        }
    }

    public async send_cw20_token(
        contract: string,
        sender: Wallet,
        amount: number,
        inputMsg: object,
        dstContractAddr: string
    ): Promise<void> {
        const sendExecution = await execute(sender, contract, {
            send: {
                contract: dstContractAddr,
                amount: `${amount}`,
                msg: Buffer.from(JSON.stringify(inputMsg)).toString("base64"),
            },
        });
        if (isTxError(sendExecution)) {
            throw new Error(`Couldn't run: ${sendExecution.raw_log}`);
        }
    }

    public async send_from_cw20_token(
        contract: string,
        sender: Wallet,
        owner: Wallet,
        amount: number,
        inputMsg: object,
        contracAddr: string
    ): Promise<void> {
        const sendExecution = await execute(sender, contract, {
            send_from: {
                owner: `${owner.key.accAddress}`,
                contract: contracAddr,
                amount: `${amount}`,
                msg: Buffer.from(JSON.stringify(inputMsg)).toString("base64"),
            },
        });
        if (isTxError(sendExecution)) {
            throw new Error(`Couldn't run: ${sendExecution.raw_log}`);
        }
    }

    public async transfer_cw20_token(
        contract: string,
        sender: Wallet,
        rcv: Wallet,
        amount: number,
    ): Promise<void> {
        const transferExecution = await execute(sender, contract, {
            transfer: {
                recipient: `${rcv.key.accAddress}`,
                amount: `${amount}`,
            },
        });
        if (isTxError(transferExecution)) {
            throw new Error(`Couldn't run: ${transferExecution.raw_log}`);
        }
    }

    public async transfer_from_cw20_token(
        contract: string,
        sender: Wallet,
        owner: Wallet,
        rcv: Wallet,
        amount: number
    ): Promise<void> {
        const transferExecution = await execute(sender, contract, {
            transfer_from: {
                owner: `${owner.key.accAddress}`,
                recipient: `${rcv.key.accAddress}`,
                amount: `${amount}`,
            },
        });
        if (isTxError(transferExecution)) {
            throw new Error(`Couldn't run: ${transferExecution.raw_log}`);
        }
    }

    public async burn_cw20_token(
        contract: string,
        sender: Wallet,
        amount: number
    ): Promise<void> {
        const transferExecuttion = await execute(sender, contract, {
            burn: {
                amount: `${amount}`,
            },
        });
        if (isTxError(transferExecuttion)) {
            throw new Error(`Couldn't run: ${transferExecuttion.raw_log}`);
        }
    }

    public async burn_from_cw20_token(
        contract: string,
        sender: Wallet,
        owner: Wallet,
        amount: number
    ): Promise<void> {
        const transferExecuttion = await execute(sender, contract, {
            burn_from: {
                owner: `${owner.key.accAddress}`,
                amount: `${amount}`,
            },
        });
        if (isTxError(transferExecuttion)) {
            throw new Error(`Couldn't run: ${transferExecuttion.raw_log}`);
        }
    }

    public async increase_allowance(
        contract: string,
        sender: Wallet,
        spender: string,
        amount: number,
        expire: Expire
    ): Promise<void> {
        const execution = await execute(
            sender,
            contract,
            {
                increase_allowance: {
                    spender: spender,
                    amount: `${amount}`,
                    expires: expire,
                },
            }
        );
        if (isTxError(execution)) {
            throw new Error(`Couldn't run: ${execution.raw_log}`);
        }
    }

    public async decrease_allowance(
        contract: string,
        sender: Wallet,
        spender: string,
        amount: number,
        expire: Expire
    ): Promise<void> {
        const execution = await execute(
            sender,
            contract,
            {
                decrease_allowance: {
                    spender: spender,
                    amount: `${amount}`,
                    expires: expire,
                },
            }
        );
        if (isTxError(execution)) {
            throw new Error(`Couldn't run: ${execution.raw_log}`);
        }
    }

    public async add_airdrop_info(
        sender: Wallet,
        token: string,
        aidrop: string,
        pair: string
    ): Promise<void> {
        const execution = await execute(
            sender,
            this.contractInfo.lido_cosmos_airdrop_registry.contractAddress,
            {
                add_airdrop_info: {
                    airdrop_token: "ANC",
                    airdrop_info: {
                        airdrop_token_contract: token,
                        airdrop_contract: aidrop,
                        airdrop_swap_contract: pair,
                        swap_belief_price: null,
                        swap_max_spread: null,
                    },
                },
            }
        );
        if (isTxError(execution)) {
            throw new Error(`Couldn't run: ${execution.raw_log}`);
        }
    }

    public async bank_send(
        sender: Wallet,
        receiver: string,
        amount: Coins
    ): Promise<void> {
        const msg = await execute_bank(sender, amount, receiver);
        if (isTxError(msg)) {
            throw new Error(`Couldn't run: ${msg.raw_log}`);
        }
    }

    public async add_guardians(sender: Wallet, guardians: Array<string>): Promise<void> {
        const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
        const addGuardians = await execute(sender, contract, {
            add_guardians: {addresses: guardians},
        });
        if (isTxError(addGuardians)) {
            throw new Error(`Couldn't run: ${addGuardians.raw_log}`);
        }
    }

    public async remove_guardians(sender: Wallet, guardians: Array<string>): Promise<void> {
        const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
        const removeGuardians = await execute(sender, contract, {
            remove_guardians: {addresses: guardians},
        });
        if (isTxError(removeGuardians)) {
            throw new Error(`Couldn't run: ${removeGuardians.raw_log}`);
        }
    }

    public async pauseContracts(sender: Wallet): Promise<void> {
        const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
        const pauseContracts = await execute(sender, contract, {
            pause_contracts: {},
        });
        if (isTxError(pauseContracts)) {
            throw new Error(`Couldn't run: ${pauseContracts.raw_log}`);
        }
    }

    public async unpauseContracts(sender: Wallet): Promise<void> {
        const contract = this.contractInfo.lido_cosmos_hub.contractAddress;
        const unpauseContracts = await execute(sender, contract, {
            unpause_contracts: {},
        });
        if (isTxError(unpauseContracts)) {
            throw new Error(`Couldn't run: ${unpauseContracts.raw_log}`);
        }
    }

    public async fabricate_mir_claim(
        sender: Wallet,
        stage: number,
        amount: string,
        proof: Array<string>
    ): Promise<void> {
        const execution = await execute(
            sender,
            this.contractInfo.lido_cosmos_airdrop_registry.contractAddress,
            {
                fabricate_mir_claim: {
                    stage: stage,
                    amount: amount,
                    proof: proof
                },
            }
        );
        if (isTxError(execution)) {
            throw new Error(`Couldn't run: ${execution.raw_log}`);
        }
    }
}

async function execute_bank(
    sender: Wallet,
    amount: Coins,
    to: string
): ReturnType<typeof send_transaction> {
    return await send_transaction(sender, [
        new MsgSend(sender.key.accAddress, to, amount),
    ]);
}