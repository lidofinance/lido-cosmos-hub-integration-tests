import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { exec } from 'child_process';
import Lido from '../helper/spawn';
import { CosmosWrapper } from './cosmos';
import { Validator } from 'cosmjs-types/cosmos/staking/v1beta1/staking';
import { setTestParams } from '../parameters/contract-tests-parameteres';
import * as path from 'path';
import LidoAsset from '../helper/lido_helper';
import {
  createMultisigThresholdPubkey,
  encodeSecp256k1Pubkey,
  MultisigThresholdPubkey,
  SinglePubkey,
} from '@cosmjs/amino';

const config = require('../config.json');
const node0Config = require('../../testkit/configs/node0/simd/config/genesis.json');

export const ValidatorsKeys = [];
for (let i = 0; i < 4; i++) {
  ValidatorsKeys.push(
    require(`../../testkit/configs/node${i}/simd/key_seed.json`).secret,
  );
}

export const mnemonicToWallet = async (
  mnemonic: string,
): Promise<DirectSecp256k1HdWallet> =>
  DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'wasm' });

export const mnemonicToPubkey = async (
  mnemonic: string,
): Promise<SinglePubkey> => {
  const wallet = await mnemonicToWallet(mnemonic);
  return encodeSecp256k1Pubkey((await wallet.getAccounts())[0].pubkey);
};

export const vals: { address: string; name: string }[] =
  node0Config.app_state.genutil.gen_txs
    .map((tx) => tx.body.messages[0].validator_address)
    .map((address, idx) => ({
      address,
      name: `node${idx}`,
    }));

export const accKeys = config.accKeys;

export const multisigKeys = config.multisigKeys;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const disconnectValidator = async (name: string) => {
  const { stdout } = await exec(`docker stop ${name}`);
  return stdout;
};

export class TestStateLocalCosmosTestNet {
  validators: Validator[];
  lido: Lido;
  gasStation: DirectSecp256k1HdWallet;
  wrapper: CosmosWrapper;
  lasset: LidoAsset;
  wallets: Record<string, DirectSecp256k1HdWallet>;
  validators_addresses: Array<string>;
  multisigPublicKey: MultisigThresholdPubkey;
  init = async (params = {}) => {
    this.wallets = {
      valAWallet: await mnemonicToWallet(ValidatorsKeys[0]),
      valBWallet: await mnemonicToWallet(ValidatorsKeys[1]),
      valCWallet: await mnemonicToWallet(ValidatorsKeys[2]),
      valDWallet: await mnemonicToWallet(ValidatorsKeys[3]),

      ownerWallet: await mnemonicToWallet(accKeys[0]),
      a: await mnemonicToWallet(accKeys[0]),
      b: await mnemonicToWallet(accKeys[1]),
      c: await mnemonicToWallet(accKeys[2]),
      d: await mnemonicToWallet(accKeys[3]),

      lido_fee: await mnemonicToWallet(accKeys[4]),
      gasStation: await mnemonicToWallet(accKeys[5]),
    };
    this.gasStation = await mnemonicToWallet(accKeys[5]);
    console.log('init multisig keys');
    this.multisigPublicKey = createMultisigThresholdPubkey(
      await Promise.all(multisigKeys.map(mnemonicToPubkey)),
      2,
      true,
    );
    this.validators_addresses = [vals[0].address];
    this.wrapper = new CosmosWrapper();
    await this.wrapper.init(this.wallets.ownerWallet);
    this.lido = new Lido(this.wrapper, this.wallets.ownerWallet);
    this.validators = (
      await this.wrapper.queryClient.staking.validators('BOND_STATUS_BONDED')
    ).validators;

    await this.lido.store_contracts_localcosmos(
      path.resolve(__dirname, '../../lido-cosmos-contracts/artifacts'),
    );

    await this.lido.instantiate_localcosmos(
      setTestParams(
        this.validators_addresses[0],
        (
          await this.wallets.a.getAccounts()
        )[0].address,
        (
          await this.wallets.lido_fee.getAccounts()
        )[0].address,
      ),
      this.validators_addresses,
      params,
    );
    this.lasset = this.lido.lAsset;
  };

  async waitForJailed(threshold?: number): Promise<void> {
    let c = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      c++;
      if (threshold != undefined && c > threshold) {
        throw new Error('timed out for waiting jailing validator');
      }
      const unbondedValidators =
        await this.wrapper.queryClient.staking.validators(
          'BOND_STATUS_UNBONDED',
        );

      if (
        unbondedValidators.pagination.total > 0 &&
        unbondedValidators.validators.find((v) => v.jailed)
      ) {
        break;
      }
      await sleep(10000);
    }
  }
}
