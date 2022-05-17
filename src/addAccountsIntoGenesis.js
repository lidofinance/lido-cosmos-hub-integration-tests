const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const config = require('./config.json');
const fs = require('fs');
const mnemonicToWallet = async (mnemonic) =>
  DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'wasm' });

(async () => {
  const addresses = [
    ...new Set(
      await Promise.all(
        [...config.accKeys, ...config.multisigKeys].map(async (key) => {
          const wallet = await mnemonicToWallet(key);
          return (await wallet.getAccounts())[0].address;
        }),
      ),
    ),
  ];
  // const addresses = ['wasm12grv9zxa4fvakctukadyqc0uuwknzl5y93nq2a'];
  for (let i = 0; i < 4; i++) {
    const nodeConfig = JSON.parse(
      fs.readFileSync(`testkit/configs/node${i}/simd/config/genesis.json`),
    );
    const currentAccounts = nodeConfig.app_state.bank.balances.map(
      (one) => one.address,
    );
    const accountsToBeAdded = addresses.filter(
      (one) => !currentAccounts.includes(one),
    );

    let added = 0;
    for (const acc of accountsToBeAdded) {
      nodeConfig.app_state.bank.balances.push({
        address: acc,
        coins: [
          {
            denom: 'stake',
            amount: '500000000',
          },
        ],
      });
      nodeConfig.app_state.auth.accounts.push({
        '@type': '/cosmos.auth.v1beta1.BaseAccount',
        address: acc,
        pub_key: null,
        account_number: '0',
        sequence: '0',
      });
      added += 500000000;
    }
    const supply = nodeConfig.app_state.bank.supply.find(
      (one) => one.denom === 'stake',
    );
    supply.amount = (parseInt(supply.amount) + added).toString();
    fs.writeFileSync(
      `testkit/configs/node${i}/simd/config/genesis.json`,
      JSON.stringify(nodeConfig, null, 2),
    );
  }
})();
