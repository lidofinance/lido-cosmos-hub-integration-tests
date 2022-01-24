import LidoAssetQueryHelper from "../helper/lasset_queryhelper";
import {emptyBlockWithFixedGas} from "../helper/flow/gas-station";
import {floateq, mustFail, mustPass} from "../helper/flow/must";
import {MantleState} from "../mantle-querier/MantleState";
import {TestStateLocalTestNet} from "./common_localtestnet";
var assert = require('assert');



async function main() {
    const testState = new TestStateLocalTestNet()
    await testState.init()

    const querier = new LidoAssetQueryHelper(
        testState.lcdClient,
        testState.lasset,
    )
    const stlunaContractAddress = testState.lasset.contractInfo.lido_terra_token_stluna.contractAddress


    await mustPass(testState.lasset.bond_for_stluna(testState.wallets.a, 10_000_000_000))
    assert.equal(await querier.balance_stluna(testState.wallets.a.key.accAddress), 10_000_000_000)


    await mustPass(testState.lasset.transfer_cw20_token(
        stlunaContractAddress, testState.wallets.a, testState.wallets.b, 2_000_000_000))
    assert.equal(await querier.balance_stluna(testState.wallets.a.key.accAddress), 8_000_000_000)
    assert.equal(await querier.balance_stluna(testState.wallets.b.key.accAddress), 2_000_000_000)
    assert.equal((await querier.token_info_stluna()).total_supply, 10_000_000_000)

    // MUST FAIL
    await mustFail(testState.lasset.burn_cw20_token(stlunaContractAddress, testState.wallets.b, 2_100_000_000))
    assert.equal(await querier.balance_stluna(testState.wallets.b.key.accAddress), 2_000_000_000)
    assert.equal(await querier.total_bond_stluna_amount(), 10_000_000_000)
    assert.equal((await querier.token_info_stluna()).total_supply, 10_000_000_000)

    await mustPass(testState.lasset.burn_cw20_token(stlunaContractAddress, testState.wallets.b, 2_000_000_000))
    // new exchange rate after burn
    let er = await querier.stluna_exchange_rate()
    assert.equal(er, 1.25)
    assert.equal(await querier.balance_stluna(testState.wallets.b.key.accAddress), 0)
    assert.equal((await querier.token_info_stluna()).total_supply, 8_000_000_000)


    await mustPass(emptyBlockWithFixedGas(testState.lcdClient, testState.gasStation, 50))
    const initial_uluna_balance = Number((await testState.wallets.a.lcd.bank.balance(testState.wallets.a.key.accAddress))[0].get("uluna").amount)
    await mustPass(testState.lasset.send_cw20_token(
        stlunaContractAddress,
        testState.wallets.a,
        1_000_000_000,
        {unbond: {}},
        testState.lasset.contractInfo["lido_terra_hub"].contractAddress
    ))
    await mustPass(emptyBlockWithFixedGas(testState.lcdClient, testState.gasStation, 50))
    await mustPass(testState.lasset.finish(testState.wallets.a))
    assert.equal(await querier.total_bond_stluna_amount(), 8_750_000_000 )
    assert.equal((await querier.token_info_stluna()).total_supply, 7_000_000_000)
    assert.equal(await querier.balance_stluna(testState.wallets.a.key.accAddress), 7_000_000_000)
    const uluna_balance = Number((await testState.wallets.a.lcd.bank.balance(testState.wallets.a.key.accAddress))[0].get("uluna").amount)
    let history = (await querier.all_history()).history
    let withdrawal_rate = Number(history[0].stluna_withdraw_rate)
    assert.equal(uluna_balance, initial_uluna_balance + 1_000_000_000 * withdrawal_rate)


    // MUST FAIL
    // // mint message allowed only from hub contract as sender
    await mustFail(testState.lasset.mint_cw20_token(
        stlunaContractAddress,
        testState.wallets.a,
        testState.lasset.contractInfo["lido_terra_hub"].contractAddress,
        100000))

    // TransferFrom
    await mustPass(testState.lasset.increase_allowance(stlunaContractAddress, testState.wallets.a, testState.wallets.b.key.accAddress, 4_000_000_000, {never: {}}))
    await mustPass(testState.lasset.transfer_from_cw20_token(stlunaContractAddress, testState.wallets.b, testState.wallets.a, testState.wallets.b, 1_000_000_000))
    assert.equal(await querier.balance_stluna(testState.wallets.a.key.accAddress), 6_000_000_000)
    assert.equal(await querier.balance_stluna(testState.wallets.b.key.accAddress), 1_000_000_000)
    await mustPass(testState.lasset.transfer_from_cw20_token(stlunaContractAddress, testState.wallets.b, testState.wallets.a, testState.wallets.b, 2_000_000_000))
    assert.equal(await querier.balance_stluna(testState.wallets.a.key.accAddress), 4_000_000_000)
    assert.equal(await querier.balance_stluna(testState.wallets.b.key.accAddress), 3_000_000_000)
    await mustPass(testState.lasset.decrease_allowance(stlunaContractAddress, testState.wallets.a, testState.wallets.b.key.accAddress, 1_000_000_000, {never: {}}))
    // MUST FAIL
    await mustFail(testState.lasset.transfer_from_cw20_token(stlunaContractAddress, testState.wallets.b, testState.wallets.a, testState.wallets.b, 2_000_000_000))
    assert.equal(await querier.balance_stluna(testState.wallets.a.key.accAddress), 4_000_000_000)
    assert.equal(await querier.balance_stluna(testState.wallets.b.key.accAddress), 3_000_000_000)

    // // BurnFrom
    await mustPass(testState.lasset.increase_allowance(stlunaContractAddress, testState.wallets.a, testState.wallets.b.key.accAddress, 2_000_000_000, {never: {}}))
    await mustPass(testState.lasset.burn_from_cw20_token(stlunaContractAddress, testState.wallets.b, testState.wallets.a, 1_000_000_000))
    assert.equal(await querier.balance_stluna(testState.wallets.a.key.accAddress), 3_000_000_000)
    assert.equal((await querier.token_info_stluna()).total_supply, 6_000_000_000)
    await mustPass(testState.lasset.decrease_allowance(stlunaContractAddress, testState.wallets.a, testState.wallets.b.key.accAddress, 1_000_000_000, {never: {}}))
    // MUST FAIL
    await mustFail(testState.lasset.burn_from_cw20_token(stlunaContractAddress, testState.wallets.b, testState.wallets.a, 1_000_000_000))
    assert.equal(await querier.balance_stluna(testState.wallets.a.key.accAddress), 3_000_000_000)
    assert.equal((await querier.token_info_stluna()).total_supply, 6_000_000_000)


    // SendFrom
    const initial_uluna_balance_b = Number((await testState.wallets.b.lcd.bank.balance(testState.wallets.b.key.accAddress))[0].get("uluna").amount)
    await mustPass(testState.lasset.increase_allowance(stlunaContractAddress, testState.wallets.a, testState.wallets.b.key.accAddress, 2_000_000_000, {never: {}}))
    await mustPass(testState.lasset.send_from_cw20_token(stlunaContractAddress, testState.wallets.b, testState.wallets.a,
        1_000_000_000,
        {unbond: {}},
        testState.lasset.contractInfo["lido_terra_hub"].contractAddress))
    await mustPass(emptyBlockWithFixedGas(testState.lcdClient, testState.gasStation, 50))
    await mustPass(testState.lasset.finish(testState.wallets.b))
    const uluna_balance_b = Number((await testState.wallets.a.lcd.bank.balance(testState.wallets.b.key.accAddress))[0].get("uluna").amount)
    history = (await querier.all_history()).history
    const total_withdrawals = history.length
    withdrawal_rate = Number(history[history.length - 1].stluna_withdraw_rate)
    assert.equal(uluna_balance_b, initial_uluna_balance_b + 1_000_000_000 * withdrawal_rate)
    assert.equal((await querier.token_info_stluna()).total_supply, 5_000_000_000)
    await mustPass(testState.lasset.decrease_allowance(stlunaContractAddress, testState.wallets.a, testState.wallets.b.key.accAddress, 1_000_000_000, {never: {}}))
    // MUST FAIL
    await mustFail(testState.lasset.send_from_cw20_token(stlunaContractAddress, testState.wallets.b, testState.wallets.a,
        1_000_000_000,
        {unbond: {}},
        testState.lasset.contractInfo["lido_terra_hub"].contractAddress)
    )
    assert.equal(total_withdrawals, (await querier.all_history()).history.length)
    assert.equal(uluna_balance_b, Number((await testState.wallets.a.lcd.bank.balance(testState.wallets.b.key.accAddress))[0].get("uluna").amount))
    assert.equal(await querier.balance_stluna(testState.wallets.a.key.accAddress), 2_000_000_000)
    assert.equal((await querier.token_info_stluna()).total_supply, 5_000_000_000)


}

main()
    .then(() => console.log("done"))
    .catch(console.log);
