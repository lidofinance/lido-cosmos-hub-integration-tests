import '../helper/cosmos.js.mocker';
import AnchorbAssetQueryHelper from '../helper/lasset_queryhelper';
import { atomDenom } from '../helper/types/coin';
import {
  sleep,
  TestStateLocalCosmosTestNet,
  vals,
} from './common_localcosmosnet';

describe('Redistribution', () => {
  const testState = new TestStateLocalCosmosTestNet();
  const initial_delegations = [2_500, 1_300, 700, 300];
  let querier;
  beforeAll(async () => {
    await testState.init();
    querier = new AnchorbAssetQueryHelper(testState.wrapper, testState.lasset);
  });
  test('add validators', async () => {
    for (const [i, val] of Object.entries(vals)) {
      await testState.lasset.add_validator(testState.wallets.a, val.address);
      await testState.lasset.bond_for_statom(
        testState.wallets.a,
        initial_delegations[i],
      );
    }
  });
  test('validate validator', async () => {
    //TBC: is bond should be added to the first validator balance?
    const validators = await querier.get_validators_for_delegation();
    for (const [i, initial_delegation] of Object.entries(initial_delegations)) {
      expect(
        Number(
          (validators.find((v) => v.address === vals[i].address) || {})
            .total_delegated || 0,
        ),
      ).toEqual(initial_delegation);
    }
  });

  test('update config', async () => {
    const res = await testState.lasset.update_config(
      testState.wallets.a,
      (
        await testState.wallets.c.getAccounts()
      )[0].address,
    );
    expect(res.code).toEqual(0);
  });

  test('previous creator is not allowed to make redelegation anymore', async () => {
    await expect(
      testState.lasset.redelegate_proxy(
        testState.wallets.ownerWallet,
        vals[0].address,
        [[vals[1].address, { amount: '1000', denom: atomDenom }]],
      ),
    ).rejects.toThrow(/unauthorized: execute wasm contract failed/);
  });

  test('redelegate', async () => {
    const res = await testState.lasset.redelegate_proxy(
      testState.wallets.c,
      vals[0].address,
      [[vals[1].address, { amount: '1000', denom: atomDenom }]],
    );
    expect(res.code).toEqual(0);
  });

  test('redistribute', async () => {
    const validators = await querier.get_validators_for_delegation();
    await testState.lasset.redistribute(
      testState.wallets.c,
      testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
      validators.map((v) => ({
        validator: v.address,
        amount: Number(v.total_delegated),
      })),
    );
  });

  test('check validators states', async () => {
    await sleep(10000);
    const expected_validator_state = {
      wasmvaloper1w26krezzh6ag4pr5ql8ez3cq4aqfk5mkwks89y: '300',
      wasmvaloper1kcsftj2kp7dypud7e8s797z7j8cj5ds2a5k9u0: '1000',
      wasmvaloper1k4swsmsz585vmt9hzy56kaekhrsasqchtmugwe: '1200',
      wasmvaloper1ze4hfrzl400vr7rpl54m0l5lxwxgfn8v2ffmfv: '2300',
    };
    const validators = await querier.get_validators_for_delegation();
    for (const validator of validators) {
      expect(validator.total_delegated).toEqual(
        expected_validator_state[validator.address],
      );
    }
  });

  test('waiting all redelegations have completed', async () => {
    let counter = 0;
    const threshold = 15;
    while (counter < threshold) {
      const r = await testState.wrapper.queryClient.staking.redelegations(
        testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
        '',
        '',
      );
      if (r.redelegationResponses.length == 0) {
        break;
      }
      counter++;
      console.log(counter);
      await sleep(1000);
    }
  });

  test('and redistribute again', async () => {
    const validators = await querier.get_validators_for_delegation();
    await testState.lasset.redistribute(
      testState.wallets.c,
      testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
      validators.map((v) => ({
        validator: v.address,
        amount: Number(v.total_delegated),
      })),
    );
  });

  test('validators state is fine', async () => {
    const validators = await querier.get_validators_for_delegation();
    for (let i = 0; i < validators.length; i++) {
      expect(Number(validators[i].total_delegated)).toEqual(1_200);
    }
  });
});
