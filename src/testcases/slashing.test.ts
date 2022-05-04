import '../helper/cosmos.js.mocker';
import AnchorbAssetQueryHelper from '../helper/lasset_queryhelper';
import { wait } from '../helper/flow/sleep';
import {
  disconnectValidator,
  TestStateLocalCosmosTestNet,
  vals,
} from './common_localcosmosnet';

const ITER_TIMES = 72;

describe('Slashing', () => {
  const testState = new TestStateLocalCosmosTestNet();
  let querier: AnchorbAssetQueryHelper;

  let statomContractAddress: string;
  let total_statom_bond_amount_before_slashing: number;

  beforeAll(async () => {
    await testState.init();
    querier = new AnchorbAssetQueryHelper(testState.wrapper, testState.lasset);
    statomContractAddress =
      testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress;
  });

  test('add validators', async () => {
    await testState.lasset.add_validator(
      testState.wallets.ownerWallet,
      vals[1].address,
    );
    await testState.lasset.add_validator(
      testState.wallets.ownerWallet,
      vals[2].address,
    );
    await testState.lasset.add_validator(
      testState.wallets.ownerWallet,
      vals[3].address,
    );
  });

  test('exchange rate must be 1', async () => {
    expect(await querier.statom_exchange_rate()).toEqual(1);
  });

  test('bond for statom', async () => {
    const res = await testState.lasset.bond_for_statom(
      testState.wallets.ownerWallet,
      1_000,
    );
    expect(res.code).toEqual(0);
    total_statom_bond_amount_before_slashing =
      await querier.total_bond_statom_amount();
  });

  test('disconnect validator', async () => {
    await disconnectValidator('node1');
    await expect(testState.waitForJailed()).resolves.not.toThrow();
    await wait(10000);
  });

  test('validate numbers', async () => {
    expect(total_statom_bond_amount_before_slashing).toBeGreaterThan(
      await querier.total_bond_statom_amount(),
    );
  });

  test('exchange rate must drop', async () => {
    expect(await querier.statom_exchange_rate()).toBeLessThan(1);
  });

  test('bond after slashing', async () => {
    const res = await testState.lasset.bond_for_statom(testState.wallets.a, 1);
    expect(res.code).toEqual(0);
    expect(await querier.statom_exchange_rate()).toBeLessThan(1);
  });

  test('validate exchange rate', async () => {
    await wait(5000);
    expect(await querier.statom_exchange_rate()).toBeLessThan(1);
  });

  test('third bond', async () => {
    const res = await testState.lasset.bond_for_statom(
      testState.wallets.a,
      2_000,
    );
    expect(res.code).toEqual(0);
    expect(await querier.statom_exchange_rate()).toBeLessThan(1);
  });

  test('cycle of bonds', async () => {
    for (let i = 0; i < ITER_TIMES; i++) {
      const res = await testState.lasset.bond_for_statom(
        testState.wallets.a,
        2_000,
      );
      expect(res.code).toEqual(0);
    }
  });

  test('dispatch rewards', async () => {
    await wait(25000);
    const res = await testState.lasset.dispatch_rewards(testState.wallets.a);
    expect(res.code).toEqual(0);
  });

  test('unbond cycle', async () => {
    const initial_statom_balance_a = await querier.balance_statom(
      testState.wallets.a,
    );
    for (let i = 0; i < ITER_TIMES / 3; i++) {
      await testState.lasset.send_cw20_token(
        statomContractAddress,
        testState.wallets.a,
        2_000,
        { unbond: {} },
        testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
      );
    }

    expect(initial_statom_balance_a - (ITER_TIMES / 3) * 2000).toEqual(
      await querier.balance_statom(testState.wallets.a),
    );
  });

  test('withdraw', async () => {
    await testState.lasset.dispatch_rewards(testState.wallets.a);
  });
});
