import { floateq as floateq, mustPass } from "../helper/flow/must";
import { get_expected_sum_from_requests } from "./common_localtestnet";
import AnchorbAssetQueryHelper from "../helper/lasset_queryhelper";
import { wait } from "../helper/flow/sleep";
import * as assert from "assert";
import {
  disconnectValidator,
  TestStateLocalTestNet,
  vals,
} from "./common_localtestnet";

async function main() {
  const testState = new TestStateLocalTestNet();
  await testState.init();
  const querier = new AnchorbAssetQueryHelper(
    testState.lcdClient,
    testState.lasset
  );

  const statomContractAddress =
    testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress;

  // blocks 69 - 70
  await wait(1000);

  await mustPass(
    testState.lasset.add_validator(
      testState.wallets.ownerWallet,
      vals[1].address
    )
  );
  await mustPass(
    testState.lasset.add_validator(
      testState.wallets.ownerWallet,
      vals[2].address
    )
  );
  await mustPass(
    testState.lasset.add_validator(
      testState.wallets.ownerWallet,
      vals[3].address
    )
  );

  assert.ok((await querier.statom_exchange_rate()) == 1);

  await mustPass(
    testState.lasset.bond_for_statom(testState.wallets.a, 1_000_000_000)
  );

  await wait(4500);

  let total_statom_bond_amount_before_slashing = await querier.total_bond_statom_amount();

  await disconnectValidator("terradnode1");
  await testState.waitForJailed("terradnode1");

  await wait(10000);

  await mustPass(testState.lasset.slashing(testState.wallets.a));

  await wait(2500);

  let total_statom_bond_amount_after_slashing = await querier.total_bond_statom_amount();

  assert.ok(
    total_statom_bond_amount_before_slashing >
      total_statom_bond_amount_after_slashing
  );

  assert.ok((await querier.statom_exchange_rate()) < 1);

  await mustPass(testState.lasset.bond_for_statom(testState.wallets.a, 1));
  assert.ok((await querier.statom_exchange_rate()) < 1);

  await wait(5000);

  let statom_ex_rate_before_second_bond = await querier.statom_exchange_rate();
  assert.ok(statom_ex_rate_before_second_bond < 1);

  await mustPass(
    testState.lasset.bond_for_statom(testState.wallets.a, 2_000_000)
  );

  let statom_ex_rate_after_second_bond = await querier.statom_exchange_rate();

  assert.ok(statom_ex_rate_after_second_bond < 1);

  for (let i = 0; i < 74; i++) {
    await mustPass(
      testState.lasset.bond_for_statom(testState.wallets.a, 2_000_000)
    );
  }

  await mustPass(testState.lasset.dispatch_rewards(testState.wallets.a));

  // blocks 258 - 307
  await wait(25000);

  // blocks 308 - 382
  const initial_statom_balance_a = await querier.balance_statom(
    testState.wallets.a.key.accAddress
  );
  const initial_uluna_balance_a = Number(
    (
      await testState.wallets.a.lcd.bank.balance(
        testState.wallets.a.key.accAddress
      )
    )[0].get("uluna").amount
  );
  for (let i = 0; i < 75; i++) {
    await testState.lasset.send_cw20_token(
      statomContractAddress,
      testState.wallets.a,
      2_000_000,
      { unbond: {} },
      testState.lasset.contractInfo.lido_cosmos_hub.contractAddress
    );
  }

  assert.equal(
    initial_statom_balance_a - 150_000_000,
    await querier.balance_statom(testState.wallets.a.key.accAddress)
  );

  const unbond_requests_a = await querier.unbond_requests(
    testState.wallets.a.key.accAddress
  );

  // blocks 459 - 508
  await wait(25000);

  // blocks 509 - 510
  await mustPass(testState.lasset.finish(testState.wallets.a));

  //blocks 511 - 512
  await mustPass(testState.lasset.dispatch_rewards(testState.wallets.a));

  const uluna_balance_a = Number(
    (
      await testState.wallets.a.lcd.bank.balance(
        testState.wallets.a.key.accAddress
      )
    )[0].get("uluna").amount
  );

  const actual_withdrawal_sum_a =
    Number(uluna_balance_a) - initial_uluna_balance_a;

  const expected_withdrawal_sum_a = await get_expected_sum_from_requests(
    querier,
    unbond_requests_a
  );

  assert.ok(actual_withdrawal_sum_a < 150_000_001);

  assert.ok(floateq(expected_withdrawal_sum_a, actual_withdrawal_sum_a, 1e-4));
}

main()
  .then(() => console.log("done"))
  .catch(console.log);
