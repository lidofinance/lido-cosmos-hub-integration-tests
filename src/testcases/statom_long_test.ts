import {floateq, mustPass} from "../helper/flow/must";
import {emptyBlockWithFixedGas} from "../helper/flow/gas-station";
import LidoAssetQueryHelper from "../helper/lasset_queryhelper";
import {disconnectValidator, get_expected_sum_from_requests, TestStateLocalTestNet, vals} from "./common_localtestnet";
import { atomDenom } from "../helper/types/coin";
var assert = require('assert');


async function main() {
    let j;
    let i
    const testState = new TestStateLocalTestNet()
    await testState.init()

    const querier = new LidoAssetQueryHelper(
        testState.lcdClient,
        testState.lasset,
    )
    const statomContractAddress = testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress
    await mustPass(testState.lasset.add_validator(testState.wallets.ownerWallet, vals[1].address))

    const initial_uatom_balance_a = Number((await testState.wallets.a.lcd.bank.balance(testState.wallets.a.key.accAddress))[0].get(atomDenom).amount)
    const initial_uatom_balance_b = Number((await testState.wallets.b.lcd.bank.balance(testState.wallets.b.key.accAddress))[0].get(atomDenom).amount)
    const initial_uatom_balance_c = Number((await testState.wallets.c.lcd.bank.balance(testState.wallets.c.key.accAddress))[0].get(atomDenom).amount)

    const initial_uatom_balance_lido_fee = Number((await testState.wallets.lido_fee.lcd.bank.balance(testState.wallets.lido_fee.key.accAddress))[0].get(atomDenom).amount)


    //block 67
    await mustPass(emptyBlockWithFixedGas(testState.lcdClient, testState.gasStation))

    //block 68
    await mustPass(emptyBlockWithFixedGas(testState.lcdClient, testState.gasStation))

    await disconnectValidator("terradnode1")
    await testState.waitForJailed("terradnode1")

    //block 91 unjail & revive oracle
    // unjail & re-register oracle votes
    // temporarly disabling unjailing
    // await mustPass(unjail(testState.wallets.valAWallet))



    let statom_exchange_rate = await querier.statom_exchange_rate()
    assert.equal(1, statom_exchange_rate)
    //block 92 - 94
    //bond
    await mustPass(emptyBlockWithFixedGas(testState.lcdClient, testState.gasStation, 3))
    for (j = 0; j < 3; j++) {
        for (i = 0; i < 25; i++) {
            await mustPass(testState.lasset.bond_for_statom(testState.wallets.a, 2_000_000))
        }
    }
    // we are bonding 3 * 25 = 75 iterations by 2_000_000 uatom each, 150_000_000 in total
    // we are expecting to have (150_000_000 / statom_exchange_rate) statom tokens
    assert.ok(floateq(
        150_000_000 / statom_exchange_rate,
        await querier.balance_statom(testState.wallets.a.key.accAddress),
        1e-6,
    ))
    await mustPass(testState.lasset.dispatch_rewards(testState.wallets.a))
    // exchange rate is growing due to reward rebonding
    console.log(statom_exchange_rate, await querier.statom_exchange_rate())
    assert.ok(await querier.statom_exchange_rate() > statom_exchange_rate)
    statom_exchange_rate = await querier.statom_exchange_rate()


    for (j = 0; j < 3; j++) {
        for (i = 0; i < 25; i++) {
            await mustPass(testState.lasset.bond_for_statom(testState.wallets.b, 2_000_000))
        }
    }
    // we are bonding 3 * 25 = 75 iterations by 2_000_000 uatom each, 150_000_000 in total
    // we are expecting to have (150_000_000 / statom_exchange_rate) statom tokens
    assert.ok(floateq(
        150_000_000 / statom_exchange_rate,
        await querier.balance_statom(testState.wallets.b.key.accAddress),
        1e-6,
    ))
    await mustPass(testState.lasset.dispatch_rewards(testState.wallets.b))
    // exchange rate is growing due to reward rebonding
    assert.ok(await querier.statom_exchange_rate() > statom_exchange_rate)
    statom_exchange_rate = await querier.statom_exchange_rate()


    for (j = 0; j < 3; j++) {
        for (i = 0; i < 25; i++) {
            await mustPass(testState.lasset.bond_for_statom(testState.wallets.c, 2_000_000))
        }
    }
    // we are bonding 3 * 25 = 75 iterations by 2_000_000 uatom each, 150_000_000 in total
    // we are expecting to have (150_000_000 / statom_exchange_rate) statom tokens
    assert.ok(floateq(
        150_000_000 / statom_exchange_rate,
        await querier.balance_statom(testState.wallets.c.key.accAddress),
        1e-6,
    ))
    await mustPass(testState.lasset.dispatch_rewards(testState.wallets.c))
    // exchange rate is growing due to reward rebonding
    assert.ok(await querier.statom_exchange_rate() > statom_exchange_rate)
    statom_exchange_rate = await querier.statom_exchange_rate()

    //block 95
    await mustPass(emptyBlockWithFixedGas(testState.lcdClient, testState.gasStation, 50))

    const ubond_exch_rate = await querier.statom_exchange_rate()
    for (j = 0; j < 3; j++) {
        for (i = 0; i < 25; i++) {
            await testState.lasset.send_cw20_token(
                statomContractAddress,
                testState.wallets.a,
                1_000_000,
                {unbond: {}},
                testState.lasset.contractInfo["lido_cosmos_hub"].contractAddress
            )
        }
    }
    await testState.lasset.send_cw20_token(
        statomContractAddress,
        testState.wallets.a,
        await querier.balance_statom(testState.wallets.a.key.accAddress),
        {unbond: {}},
        testState.lasset.contractInfo["lido_cosmos_hub"].contractAddress
    )


    for (j = 0; j < 3; j++) {
        for (i = 0; i < 25; i++) {
            await testState.lasset.send_cw20_token(
                statomContractAddress,
                testState.wallets.b,
                1_000_000,
                {unbond: {}},
                testState.lasset.contractInfo["lido_cosmos_hub"].contractAddress
            )
        }
    }
    await testState.lasset.send_cw20_token(
        statomContractAddress,
        testState.wallets.b,
        await querier.balance_statom(testState.wallets.b.key.accAddress),
        {unbond: {}},
        testState.lasset.contractInfo["lido_cosmos_hub"].contractAddress
    )


    for (j = 0; j < 3; j++) {
        for (i = 0; i < 25; i++) {
            await testState.lasset.send_cw20_token(
                statomContractAddress,
                testState.wallets.c,
                1_000_000,
                {unbond: {}},
                testState.lasset.contractInfo["lido_cosmos_hub"].contractAddress
            )
        }
    }
    await mustPass(emptyBlockWithFixedGas(testState.lcdClient, testState.gasStation, 20))
    await testState.lasset.send_cw20_token(
        statomContractAddress,
        testState.wallets.c,
        await querier.balance_statom(testState.wallets.c.key.accAddress),
        {unbond: {}},
        testState.lasset.contractInfo["lido_cosmos_hub"].contractAddress
    )
    await mustPass(testState.lasset.dispatch_rewards(testState.wallets.c))


    //block 99 - 159
    await mustPass(emptyBlockWithFixedGas(testState.lcdClient, testState.gasStation, 50))
    const unbond_requests_a = await querier.unbond_requests(testState.wallets.a.key.accAddress)
    const unbond_requests_b = await querier.unbond_requests(testState.wallets.b.key.accAddress)
    const unbond_requests_c = await querier.unbond_requests(testState.wallets.c.key.accAddress)
    //block 160
    await mustPass(testState.lasset.finish(testState.wallets.a))
    await mustPass(testState.lasset.finish(testState.wallets.b))
    await mustPass(testState.lasset.finish(testState.wallets.c))


    const uatom_balance_a = Number((await testState.wallets.a.lcd.bank.balance(testState.wallets.a.key.accAddress))[0].get(atomDenom).amount)
    const uatom_balance_b = Number((await testState.wallets.b.lcd.bank.balance(testState.wallets.b.key.accAddress))[0].get(atomDenom).amount)
    const uatom_balance_c = Number((await testState.wallets.c.lcd.bank.balance(testState.wallets.c.key.accAddress))[0].get(atomDenom).amount)
    const uatom_balance_lido_fee = Number((await testState.wallets.lido_fee.lcd.bank.balance(testState.wallets.lido_fee.key.accAddress))[0].get(atomDenom).amount)

    const actual_profit_sum_a = (Number(uatom_balance_a) - initial_uatom_balance_a)
    const actual_profit_sum_b = (Number(uatom_balance_b) - initial_uatom_balance_b)
    const actual_profit_sum_c = (Number(uatom_balance_c) - initial_uatom_balance_c)
    // we have unbonded all our statom tokens, we have withdrawed(testState.basset.finish) all uatom
    // our profit is "withdrawal amount" - "bonded amount"
    const expected_profit_sum_a = await get_expected_sum_from_requests(querier, unbond_requests_a) - 150_000_000
    const expected_profit_sum_b = await get_expected_sum_from_requests(querier, unbond_requests_b) - 150_000_000
    const expected_profit_sum_c = await get_expected_sum_from_requests(querier, unbond_requests_c) - 150_000_000
    // due to js float64 math precision we have to set the precision value = 1e-3, i.e. 0.1%
    assert.ok(floateq(expected_profit_sum_a, actual_profit_sum_a, 1e-3))
    assert.ok(floateq(expected_profit_sum_b, actual_profit_sum_b, 1e-3))
    assert.ok(floateq(expected_profit_sum_c, actual_profit_sum_c, 1e-3))
    assert.ok(uatom_balance_a > initial_uatom_balance_a)
    assert.ok(uatom_balance_b > initial_uatom_balance_b)
    assert.ok(uatom_balance_c > initial_uatom_balance_c)


    assert.ok(uatom_balance_lido_fee > initial_uatom_balance_lido_fee)

}

main()
    .then(() => console.log("done"))
    .catch(console.log);
