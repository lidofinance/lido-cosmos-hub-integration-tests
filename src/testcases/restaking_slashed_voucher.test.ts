import '../helper/cosmos.js.mocker';
import AnchorbAssetQueryHelper from '../helper/lasset_queryhelper';
import {
  disconnectValidator,
  TestStateLocalCosmosTestNet,
  vals,
} from './common_localcosmosnet';
import { Coin } from '@cosmjs/stargate';
import { getResponseAttributes } from '../helper/flow/response';

describe('Restaking slashing', () => {
  const testState = new TestStateLocalCosmosTestNet();
  let querier: AnchorbAssetQueryHelper;
  let statomContractAddress: string;
  let validatorAddress: string;
  let tokenizedShare: Coin;

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
      testState.wallets.a,
      100_000,
    );
    expect(res.code).toEqual(0);
  });

  test('unbond', async () => {
    const res = await testState.lasset.send_cw20_token(
      statomContractAddress,
      testState.wallets.a,
      1_000,
      { unbond: {} },
      testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
    );
    expect(res.code).toEqual(0);
  });

  test('get tokenized share', async () => {
    const balances = await testState.wrapper.queryClient.bank.allBalances(
      (
        await testState.wallets.a.getAccounts()
      )[0].address,
    );
    tokenizedShare = balances.find((b) => b.denom.startsWith('wasmvaloper'));
    validatorAddress = tokenizedShare.denom.substring(0, 50);
  });

  test('disconnect validator', async () => {
    const validator = (
      await testState.wrapper.queryClient.staking.validators(
        'BOND_STATUS_BONDED',
      )
    ).validators.find((v) => v.operatorAddress === validatorAddress).description
      .moniker;
    await disconnectValidator(validator);
    await expect(testState.waitForJailed()).resolves.not.toThrow();
  });

  test('receive tokenized share', async () => {
    const exchangeRate = await querier.statom_exchange_rate();
    const res = await testState.lasset.receive_tokenized_share(
      testState.wallets.a,
      tokenizedShare,
    );
    expect(res.code).toEqual(0);
    const attributes = getResponseAttributes(res, 'coin_received');
    const coin_received = Number(attributes.amount.replace(/stake/, ''));
    expect(
      Math.abs(coin_received - Number(tokenizedShare.amount) / 1.01),
    ).toBeLessThan(1);
    const wasmAttributes = getResponseAttributes(res, 'wasm');
    expect(
      Math.abs(
        Number(wasmAttributes.mint_amount) -
          Number(coin_received) / exchangeRate,
      ),
    ).toBeLessThan(1);
  });
});
