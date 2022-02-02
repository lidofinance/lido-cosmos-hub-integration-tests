import { Fee, Wallet } from "@terra-money/terra.js";
import * as path from 'path'
import Lido from "../helper/spawn";
import { Contracts } from "../mantle-querier/types"

const locationBase = path.resolve(__dirname, "../../")

export async function lido(owner: Wallet): Promise<Contracts> {
    // register ALL validators
    const validators = await owner.lcd.staking.validators()

    const lido = new Lido(owner)
    const fixedFeeForInit = new Fee(6000000, "2000000uusd")
    await lido.store_contracts(
        path.resolve(locationBase, './lido-cosmos-contracts/artifacts'),
    )

    await lido.instantiate(fixedFeeForInit, {
        lasset: {
            epoch_period: 12345,
            underlying_coin_denom: "uluna",
            unbonding_period: 86415,
            peg_recovery_fee: "0.001",
            er_threshold: "1.0",
            reward_denom: "uusd",
        },
        testAccount: owner.key.accAddress
    })

    const basset = lido.lAsset;

    console.log("registering validators...")
    await validators.reduce((t, v) => t.then(() => {
        console.log(v.operator_address)
        return basset.register_validator(owner, v.operator_address, fixedFeeForInit)
    }), Promise.resolve())

    return {
        "lidoHub": basset.contractInfo["lido_terra_hub"].contractAddress,
        "stLunaToken": basset.contractInfo["lido_terra_token_stluna"].contractAddress,
        "rewardsDispatcher": basset.contractInfo["lido_terra_rewards_dispatcher"].contractAddress,
        "validatorsRegistry": basset.contractInfo["lido_terra_validators_registry"].contractAddress,
    }
}