import '../helper/cosmos.js.mocker';
import LidoAssetQueryHelper from '../helper/lasset_queryhelper';
import { wait } from '../helper/flow/sleep';
import { TestStateLocalCosmosTestNet } from './common_localcosmosnet';
import { getResponseAttributes } from '../helper/flow/response';
import { Coin } from '@cosmjs/proto-signing';

describe('StAtom / Short', () => {
  let testState: TestStateLocalCosmosTestNet;
  let querier: LidoAssetQueryHelper;
  let statomContractAddress;
  beforeAll(async () => {
    testState = new TestStateLocalCosmosTestNet();
    await testState.init();
    querier = new LidoAssetQueryHelper(testState.wrapper, testState.lasset);
    statomContractAddress =
      testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress;
  });
  describe('stake', () => {
    let startBalance: number;
    beforeAll(async () => {
      startBalance = await querier.balance_statom(testState.wallets.a);
    });
    test('regular', async () => {
      const response = await testState.lasset.bond_for_statom(
        testState.wallets.a,
        10_000,
      );
      expect(response.code).toEqual(0);
      expect(response.height).toBeGreaterThan(0);
      const attributes = getResponseAttributes(response, 'coin_received');
      expect(attributes.amount).toEqual('10000stake');
    });
    test('balance by query should be increased', async () => {
      await wait(5000);
      const balance = await querier.balance_statom(testState.wallets.a);
      expect(balance - startBalance).toEqual(10_000);
    });
  });
  describe('transfer statom', () => {
    test('transfer', async () => {
      const res = await testState.lasset.transfer_cw20_token(
        statomContractAddress,
        testState.wallets.a,
        testState.wallets.b,
        2_000,
      );
      expect(res.code).toEqual(0);
      expect(res.height).toBeGreaterThan(0);
      const attributes = getResponseAttributes(res, 'wasm');
      expect(attributes.amount).toEqual('2000');
    });
    test('balances updated properly', async () => {
      const balanceA = await querier.balance_statom(testState.wallets.a);
      const balanceB = await querier.balance_statom(testState.wallets.b);
      expect(balanceA).toEqual(8_000);
      expect(balanceB).toEqual(2_000);
    });
    test('total supply is still the same', async () => {
      const totalSupply = Number(
        (await querier.token_info_statom()).total_supply,
      );
      expect(totalSupply).toEqual(10_000);
    });
  });
  describe('burn', () => {
    describe('more than balance', () => {
      test("shouldn't burn more than balance", async () => {
        await expect(
          testState.lasset.burn_cw20_token(
            statomContractAddress,
            testState.wallets.b,
            2_100,
          ),
        ).rejects.toThrow(/Cannot Sub with 2000 and 2100/);
      });
      test("balance should't change", async () => {
        const balanceB = await querier.balance_statom(testState.wallets.b);
        expect(balanceB).toEqual(2_000);
      });
      test('total supply is still the same', async () => {
        const totalSupply = Number(
          (await querier.token_info_statom()).total_supply,
        );
        expect(totalSupply).toEqual(10_000);
      });
    });
    describe('eq balance', () => {
      test('burn', async () => {
        const res = await testState.lasset.burn_cw20_token(
          statomContractAddress,
          testState.wallets.b,
          2_000,
        );
        expect(res.code).toEqual(0);
        expect(res.height).toBeGreaterThan(0);
        const attributes = getResponseAttributes(res, 'wasm');
        expect(attributes.amount).toEqual('2000');
      });
      test('exchange rate changed', async () => {
        const er = await querier.statom_exchange_rate();
        expect(er).toEqual(1.25);
      });
      test('balance changed', async () => {
        const balanceB = await querier.balance_statom(testState.wallets.b);
        expect(balanceB).toEqual(0);
      });
      test('total supply decreased', async () => {
        expect(
          Number((await querier.token_info_statom()).total_supply),
        ).toEqual(8_000);
      });
    });
    describe('unbond', () => {
      let initialBondAmount: number;
      let initialTotalSupply: number;
      let initialBalance: number;
      let exchangeRate: number;
      beforeAll(async () => {
        await wait(25000);
        exchangeRate = await querier.statom_exchange_rate();
        initialBondAmount = await querier.total_bond_statom_amount();
        initialTotalSupply = Number(
          (await querier.token_info_statom()).total_supply,
        );
        initialBalance = await querier.balance_statom(testState.wallets.a);
      });
      test('do', async () => {
        const res = await testState.lasset.send_cw20_token(
          statomContractAddress,
          testState.wallets.a,
          1_000,
          { unbond: {} },
          testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
        );
        expect(res.code).toEqual(0);
      });

      test('tokenized shares must appear', async () => {
        const balances = await testState.wrapper.queryClient.bank.allBalances(
          (
            await testState.wallets.a.getAccounts()
          )[0].address,
        );

        const share = balances.some(({ denom, amount }) =>
          testState.validators_addresses.some(
            (v) =>
              v === denom.slice(0, -1) &&
              Number(amount) === 1000 * exchangeRate,
          ),
        );

        expect(share).toBeTruthy();
      });

      test('statom balance changed', async () => {
        const balance = await querier.balance_statom(testState.wallets.a);
        expect(initialBalance - balance).toEqual(1_000);
      });
      test('total bond amount must change', async () => {
        const currentBondAmount = await querier.total_bond_statom_amount();
        expect(initialBondAmount - currentBondAmount).toEqual(
          1_000 * exchangeRate,
        );
      });
      test('total supply must change', async () => {
        expect(
          initialTotalSupply -
            Number((await querier.token_info_statom()).total_supply),
        ).toEqual(1_000);
      });
    });

    describe('receive tokenized share', () => {
      let tokenizedShare: Coin;
      let startingStatomBalance: number;
      beforeAll(async () => {
        const balances = await testState.wrapper.queryClient.bank.allBalances(
          (
            await testState.wallets.a.getAccounts()
          )[0].address,
        );
        tokenizedShare = balances.find((b) =>
          b.denom.startsWith('wasmvaloper'),
        );
        startingStatomBalance = await querier.balance_statom(
          testState.wallets.a,
        );
      });
      test('receive tokenized share', async () => {
        const res = await testState.lasset.receive_tokenized_share(
          testState.wallets.a,
          tokenizedShare,
        );
        expect(res.code).toEqual(0);
      });
      test('tokenized share must be spent', async () => {
        const balances = await testState.wrapper.queryClient.bank.allBalances(
          (
            await testState.wallets.a.getAccounts()
          )[0].address,
        );
        expect(
          balances.find((b) => b.denom.startsWith('wasmvaloper')),
        ).toBeFalsy();
      });
      test('statom balance must be increased', async () => {
        expect(
          (await querier.balance_statom(testState.wallets.a)) -
            startingStatomBalance,
        ).toEqual(1_000);
      });
    });
  });
  describe('mint', () => {
    test('mint message allowed only from hub contract as sender', async () => {
      await expect(
        testState.lasset.mint_cw20_token(
          statomContractAddress,
          testState.wallets.a,
          testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
          1000,
        ),
      ).rejects.toThrow(/Unauthorized/);
    });
    test('increase allowance', async () => {
      const res = await testState.lasset.increase_allowance(
        statomContractAddress,
        testState.wallets.a,
        testState.wallets.b,
        4_000,
        { never: {} },
      );
      expect(res.code).toEqual(0);
    });
    test('transfer statom step 1', async () => {
      const startA = await querier.balance_statom(testState.wallets.a);
      const startB = await querier.balance_statom(testState.wallets.b);
      const res = await testState.lasset.transfer_from_cw20_token(
        statomContractAddress,
        testState.wallets.b,
        testState.wallets.a,
        testState.wallets.b,
        1_000,
      );
      expect(res.code).toEqual(0);
      expect(
        startA - (await querier.balance_statom(testState.wallets.a)),
      ).toEqual(1_000);
      expect(
        startB - (await querier.balance_statom(testState.wallets.b)),
      ).toEqual(-1_000);
    });
    test('transfer statom step 2', async () => {
      const startA = await querier.balance_statom(testState.wallets.a);
      const startB = await querier.balance_statom(testState.wallets.b);
      const res = await testState.lasset.transfer_from_cw20_token(
        statomContractAddress,
        testState.wallets.b,
        testState.wallets.a,
        testState.wallets.b,
        2_000,
      );
      expect(res.code).toEqual(0);
      expect(
        startA - (await querier.balance_statom(testState.wallets.a)),
      ).toEqual(2_000);
      expect(
        startB - (await querier.balance_statom(testState.wallets.b)),
      ).toEqual(-2_000);
    });
    test('decrease allowance', async () => {
      const res = await testState.lasset.decrease_allowance(
        statomContractAddress,
        testState.wallets.a,
        testState.wallets.b,
        1_000,
        { never: {} },
      );
      expect(res.code).toEqual(0);
    });
    test('should fail transfer', async () => {
      const startA = await querier.balance_statom(testState.wallets.a);
      const startB = await querier.balance_statom(testState.wallets.b);
      await expect(
        testState.lasset.transfer_from_cw20_token(
          statomContractAddress,
          testState.wallets.b,
          testState.wallets.a,
          testState.wallets.b,
          2_000,
        ),
      ).rejects.toThrow(
        / No allowance for this account: execute wasm contract failed/,
      );
      expect(await querier.balance_statom(testState.wallets.a)).toEqual(startA);
      expect(await querier.balance_statom(await testState.wallets.b)).toEqual(
        startB,
      );
    });
  });
  describe('BurnFrom', () => {
    test('increase allowance and burn_from_cw20_token', async () => {
      const startA = await querier.balance_statom(testState.wallets.a);
      const startB = await querier.balance_statom(testState.wallets.b);
      const res = await testState.lasset.increase_allowance(
        statomContractAddress,
        testState.wallets.a,
        testState.wallets.b,
        2_000,
        { never: {} },
      );
      expect(res.code).toEqual(0);
      await testState.lasset.burn_from_cw20_token(
        statomContractAddress,
        testState.wallets.b,
        testState.wallets.a,
        1_000,
      );
      expect(await querier.balance_statom(testState.wallets.a)).toEqual(
        startA - 1_000,
      );
      expect(await querier.balance_statom(testState.wallets.b)).toEqual(startB);
    });
    test('decrease allowance and burn', async () => {
      const startA = await querier.balance_statom(testState.wallets.a);
      const startB = await querier.balance_statom(testState.wallets.b);
      await testState.lasset.decrease_allowance(
        statomContractAddress,
        testState.wallets.a,
        testState.wallets.b,
        1_000,
        { never: {} },
      );
      await expect(
        testState.lasset.burn_from_cw20_token(
          statomContractAddress,
          testState.wallets.b,
          testState.wallets.a,
          1_000,
        ),
      ).rejects.toThrow(
        /No allowance for this account: execute wasm contract failed/,
      );
      expect(await querier.balance_statom(testState.wallets.a)).toEqual(startA);
      expect(await querier.balance_statom(testState.wallets.b)).toEqual(startB);
    });
  });
  describe('SendFrom', () => {
    let startTotalSupply: number;
    beforeAll(async () => {
      startTotalSupply = Number(
        (await querier.token_info_statom()).total_supply,
      );
    });
    test('increase allowance', async () => {
      const resAllowance = await testState.lasset.increase_allowance(
        statomContractAddress,
        testState.wallets.a,
        testState.wallets.b,
        1_000,
        { never: {} },
      );
      expect(resAllowance.code).toEqual(0);
    });
    test('unbond', async () => {
      const resSend = await testState.lasset.send_from_cw20_token(
        statomContractAddress,
        testState.wallets.b,
        testState.wallets.a,
        250,
        { unbond: {} },
        testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
      );
      expect(resSend.code).toEqual(0);
    });

    test('check total supply', async () => {
      expect(
        startTotalSupply -
          Number((await querier.token_info_statom()).total_supply),
      ).toEqual(250);
    });

    test('decrease allowance and unbond', async () => {
      const resDecrease = await testState.lasset.decrease_allowance(
        statomContractAddress,
        testState.wallets.a,
        testState.wallets.b,
        1_000,
        { never: {} },
      );
      expect(resDecrease.code).toEqual(0);
      await expect(
        testState.lasset.send_from_cw20_token(
          statomContractAddress,
          testState.wallets.b,
          testState.wallets.a,
          750,
          { unbond: {} },
          testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
        ),
      ).rejects.toThrow(/No allowance for this account/);
    });
    test('check total supply', async () => {
      expect(
        startTotalSupply -
          Number((await querier.token_info_statom()).total_supply),
      ).toEqual(250);
    });
  });
});
