import '../helper/cosmos.js.mocker';
import { wait } from '../helper/flow/sleep';
import LidoAssetQueryHelper from '../helper/lasset_queryhelper';
import { atomDenom } from '../helper/types/coin';
import {
  disconnectValidator,
  TestStateLocalCosmosTestNet,
  vals,
} from './common_localcosmosnet';

describe('Long', () => {
  const testState = new TestStateLocalCosmosTestNet();
  let querier: LidoAssetQueryHelper;
  let statomContractAddress: string;
  let initial_uatom_balance_lido_fee: number;
  let statom_exchange_rate: number;

  beforeAll(async () => {
    await testState.init();
    querier = new LidoAssetQueryHelper(testState.wrapper, testState.lasset);
    statomContractAddress =
      testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress;

    await testState.lasset.add_validator(
      testState.wallets.ownerWallet,
      vals[1].address,
    );

    initial_uatom_balance_lido_fee = await testState.lasset.get_atom_balance(
      testState.wallets.lido_fee,
    );
  });

  test('check exchange rate', async () => {
    statom_exchange_rate = await querier.statom_exchange_rate();
    expect(statom_exchange_rate).toEqual(1);
  });

  test('bond 0', async () => {
    await testState.lasset.bond_for_statom(testState.wallets.a, 2_000_000);
    await wait(1000);
  });

  test('disconnect second node', async () => {
    await wait(1000);
    await disconnectValidator('node1');
    await testState.waitForJailed();
  });

  test('check exchange rate 0', async () => {
    await wait(10000);
    const now = await querier.statom_exchange_rate();
    expect(now).toBeLessThan(statom_exchange_rate);
    statom_exchange_rate = now;
  });

  test('bond', async () => {
    for (let i = 0; i < 74; i++) {
      await testState.lasset.bond_for_statom(testState.wallets.a, 5_000_000);
    }
  });

  test('balance statom', async () => {
    expect(
      (await querier.balance_statom(testState.wallets.a)) -
        375_000_000 / (await querier.statom_exchange_rate()),
    ).toBeLessThan(1);
  });

  test('dispatch rewards', async () => {
    await wait(30000);
    const res = await testState.lasset.dispatch_rewards(testState.wallets.a);
    expect(res.code).toEqual(0);
  });
  test('check exchange rate 1', async () => {
    await wait(15000);
    const now = await querier.statom_exchange_rate();
    expect(now).toBeGreaterThan(statom_exchange_rate);
    statom_exchange_rate = now;
  });

  test('bond 2', async () => {
    await wait(1500);
    for (let i = 0; i < 75; i++) {
      await testState.lasset.bond_for_statom(testState.wallets.b, 2_000);
    }
  });

  test('check balance 2', async () => {
    expect(
      (await querier.balance_statom(testState.wallets.b)) /
        (150_000 / statom_exchange_rate),
    ).toBeGreaterThan(0.99);
  });

  test('dispatch rewards 2', async () => {
    const res = await testState.lasset.dispatch_rewards(testState.wallets.b);
    expect(res.code).toEqual(0);
  });

  test('check exchange rate 2', async () => {
    const now = await querier.statom_exchange_rate();
    expect(now).toBeGreaterThan(statom_exchange_rate);
    statom_exchange_rate = now;
  });

  test('bond 3', async () => {
    await wait(1500);
    for (let i = 0; i < 75; i++) {
      await testState.lasset.bond_for_statom(testState.wallets.c, 2_000);
    }
  });

  test('check balance 3', async () => {
    expect(
      (await querier.balance_statom(testState.wallets.c)) /
        (150_000 / statom_exchange_rate),
    ).toBeGreaterThan(0.99);
  });

  test('check exchange rate 3', async () => {
    const now = await querier.statom_exchange_rate();
    expect(now).toBeGreaterThan(statom_exchange_rate);
    statom_exchange_rate = now;
  });

  test('dispatch rewards 3', async () => {
    const res = await testState.lasset.dispatch_rewards(testState.wallets.c);
    expect(res.code).toEqual(0);
  });

  test('unbond all', async () => {
    await Promise.all(
      ['a', 'b', 'c'].map(async (wallet) => {
        for (let i = 0; i < 75; i++) {
          await testState.lasset.send_cw20_token(
            statomContractAddress,
            testState.wallets[wallet],
            1_000,
            { unbond: {} },
            testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
          );
        }
      }),
    );
  });

  test('tokenized shares for wallet a', async () => {
    const balances = await testState.wrapper.queryClient.bank.allBalances(
      (
        await testState.wallets.a.getAccounts()
      )[0].address,
    );
    expect(balances.filter((b) => b.denom !== atomDenom).length).toEqual(75);
  });

  test('tokenized shares for wallet b', async () => {
    const balances = await testState.wrapper.queryClient.bank.allBalances(
      (
        await testState.wallets.b.getAccounts()
      )[0].address,
    );
    expect(balances.filter((b) => b.denom !== atomDenom).length).toEqual(75);
  });

  test('tokenized shares for wallet b', async () => {
    const balances = await testState.wrapper.queryClient.bank.allBalances(
      (
        await testState.wallets.b.getAccounts()
      )[0].address,
    );
    expect(balances.filter((b) => b.denom !== atomDenom).length).toEqual(75);
  });

  test('check fee balance', async () => {
    expect(
      await testState.lasset.get_atom_balance(testState.wallets.lido_fee),
    ).toBeGreaterThan(initial_uatom_balance_lido_fee);
  });
});
