import '../helper/cosmos.js.mocker';
import { TestStateLocalCosmosTestNet } from './common_localcosmosnet';
import { wait } from '../helper/flow/sleep';

describe('Pausable contracts', () => {
  const testState = new TestStateLocalCosmosTestNet();
  const stAtomBondAmount = 20_000;
  beforeAll(async () => {
    await testState.init();
    await testState.lasset.bond_for_statom(
      testState.wallets.c,
      stAtomBondAmount,
    );
    await wait(2500);
    await testState.lasset.dispatch_rewards(testState.wallets.ownerWallet);
  });
  describe('add guardians', () => {
    test('only owner can manage guardians', async () => {
      await expect(
        testState.lasset.add_guardians(testState.wallets.d, [
          (await testState.wallets.a.getAccounts())[0].address,
          (await testState.wallets.b.getAccounts())[0].address,
        ]),
      ).rejects.toThrow(/unauthorized/);
      const res = await testState.lasset.add_guardians(
        testState.wallets.ownerWallet,
        [
          (await testState.wallets.a.getAccounts())[0].address,
          (await testState.wallets.b.getAccounts())[0].address,
        ],
      );
      expect(res.code).toEqual(0);
    });
  });
  describe('pause', () => {
    test('guardian B pauses the contracts', async () => {
      const res = await testState.lasset.pause_contracts(testState.wallets.b);
      expect(res.code).toEqual(0);
    });

    test('all actions must return error on pause', async () => {
      await expect(
        testState.lasset.dispatch_rewards(testState.wallets.ownerWallet),
      ).rejects.toThrow(/contract is temporarily paused/);

      await expect(
        testState.lasset.bond_for_statom(testState.wallets.d, stAtomBondAmount),
      ).rejects.toThrow(/contract is temporarily paused/);

      await expect(
        testState.lasset.transfer_cw20_token(
          testState.lasset.contractInfo.lido_cosmos_token_statom
            .contractAddress,
          testState.wallets.d,
          testState.wallets.c,
          1_000,
        ),
      ).rejects.toThrow(/contract is temporarily paused/);

      await expect(
        testState.lasset.transfer_cw20_token(
          testState.lasset.contractInfo.lido_cosmos_token_statom
            .contractAddress,
          testState.wallets.c,
          testState.wallets.d,
          1_000,
        ),
      ).rejects.toThrow(/contract is temporarily paused/);
    });
  });
  describe('unpause', () => {
    test('only the owner can unpause contracts', async () => {
      await expect(
        testState.lasset.unpause_contracts(testState.wallets.b),
      ).rejects.toThrow(/unauthorized/);
    });
    test('owner unpauses the contracts', async () => {
      const res = await testState.lasset.unpause_contracts(
        testState.wallets.ownerWallet,
      );
      expect(res.code).toEqual(0);
    });
    test('all actions must work now', async () => {
      // check that all contracts are unpaused
      const dispatch = await testState.lasset.dispatch_rewards(
        testState.wallets.ownerWallet,
      );
      expect(dispatch.code).toEqual(0);

      const bond = await testState.lasset.bond_for_statom(
        testState.wallets.d,
        stAtomBondAmount,
      );
      expect(bond.code).toEqual(0);

      const transfer = await testState.lasset.transfer_cw20_token(
        testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress,
        testState.wallets.d,
        testState.wallets.c,
        1_000,
      );
      expect(transfer.code).toEqual(0);

      const transferCW20 = await testState.lasset.transfer_cw20_token(
        testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress,
        testState.wallets.c,
        testState.wallets.d,
        1_000,
      );
      expect(transferCW20.code).toEqual(0);
    });
  });
  describe('remove guardians', () => {
    test('only owner can manage guardians', async () => {
      await expect(
        testState.lasset.remove_guardians(testState.wallets.b, [
          (await testState.wallets.a.getAccounts())[0].address,
        ]),
      ).rejects.toThrow(/unauthorized/);
    });

    test('owner can remove guardians', async () => {
      const res = await testState.lasset.remove_guardians(
        testState.wallets.ownerWallet,
        [(await testState.wallets.b.getAccounts())[0].address],
      );
      expect(res.code).toEqual(0);
    });

    test('guardian B cannot pause the contracts because it was removed', async () => {
      await expect(
        testState.lasset.pause_contracts(testState.wallets.b),
      ).rejects.toThrow(/unauthorized/);
    });

    test('guardian A can pause the contracts', async () => {
      const res = await testState.lasset.pause_contracts(testState.wallets.a);
      expect(res.code).toEqual(0);
    });
  });
});
