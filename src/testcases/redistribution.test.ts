import '../helper/cosmos.js.mocker';
import { pubkeyToAddress } from '@cosmjs/amino';
import AnchorbAssetQueryHelper from '../helper/lasset_queryhelper';
import { atomDenom } from '../helper/types/coin';
import {
  multisigKeys,
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
      pubkeyToAddress(testState.multisigPublicKey, 'wasm'),
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
  test('one key is not enough to sign transaction', async () => {
    await testState.lasset.redelegate_proxy_multisig(
      testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
      testState.multisigPublicKey,
      multisigKeys,
      vals[0].address,
      [[vals[1].address, { amount: '1000', denom: atomDenom }]],
    );
  });

  test('redelegate', async () => {
    const res = await testState.lasset.redelegate_proxy_multisig(
      testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
      testState.multisigPublicKey,
      multisigKeys,
      vals[0].address,
      [[vals[1].address, { amount: '1000', denom: atomDenom }]],
    );
    expect(res.code).toEqual(0);
  });
  test('redistribute', async () => {
    const validators = await querier.get_validators_for_delegation();
    await testState.lasset.redistribute(
      testState.multisigPublicKey,
      multisigKeys,
      testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
      validators.map((v) => ({
        validator: v.address,
        amount: Number(v.total_delegated),
      })),
    );
  });

  test('check validators states', async () => {
    // we are redelegating to val1 (line34) - terravaloper180darp2tj7ns48r0s3l3u8a2ygxjyycsjmyhzz
    // 4000 uluna and we can not to redelegate from him
    // our delegation state should be
    const expected_validator_state = [
      {
        total_delegated: '1100000000',
        address: 'terravaloper1utdag7jnhp9zy667z78dt8hnnud2mu7vax5rsn',
      },
      {
        total_delegated: '1199996000',
        address: 'terravaloper188p7d0w6948y8p4cg5p3m6zx8lzzg8r0vt47ms',
      },
      {
        total_delegated: '1200000000',
        address: 'terravaloper1yg247q4kecqnktp2rte030yy43gpj0c9nm5nug',
      },
      {
        total_delegated: '1300004000',
        address: 'terravaloper180darp2tj7ns48r0s3l3u8a2ygxjyycsjmyhzz',
      },
    ];

    const validators = await querier.get_validators_for_delegation();
    for (let i = 0; i < validators.length; i++) {
      expect(Number(validators[i].total_delegated)).toEqual(
        Number(
          expected_validator_state.find((v) => {
            if (v.address == validators[i].address) {
              return true;
            }
          }).total_delegated,
        ),
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
  test('and redelegating again', async () => {
    let validators = await querier.get_validators_for_delegation();
    await testState.lasset.redistribute(
      testState.multisigPublicKey,
      multisigKeys,
      testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
      validators.map((v) => ({
        validator: v.address,
        amount: Number(v.total_delegated),
      })),
    );
    validators = await querier.get_validators_for_delegation();
    for (let i = 0; i < validators.length; i++) {
      expect(Number(validators[i].total_delegated)).toEqual(1_200);
    }
  });
});
