import { mustPass } from "../helper/flow/must";
import { wait } from "../helper/flow/sleep";
import { TestStateLocalTestNet } from "./common_localtestnet";
import { makeRestStoreQuery } from "../helper/lasset_queryhelper";
import { send_transaction } from "../helper/flow/execution";
import { MsgSend } from "@terra-money/terra.js";

async function getLunaBalance(testState: TestStateLocalTestNet, address) {
  let balance = await testState.lcdClient.bank.balance(address);
  return balance[0].get("uluna").amount;
}

function approxeq(a: number, b: number, e: number) {
  return Math.abs(a - b) <= e;
}

async function main() {
  const testState = new TestStateLocalTestNet();
  await testState.init();

  let bondAmount = 20_000_000_000;
  let unbondAmount = 5_000_000_000;

  await mustPass(
    testState.lasset.bond_for_statom(testState.wallets.b, bondAmount)
  );

  await wait(2500);

  await mustPass(
    testState.lasset.send_cw20_token(
      testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress,
      testState.wallets.b,
      unbondAmount,
      { unbond: {} },
      testState.lasset.contractInfo.lido_cosmos_hub.contractAddress
    )
  );

  await wait(10000);

  let withdrawableUnbonded = await makeRestStoreQuery(
    testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
    { withdrawable_unbonded: { address: testState.wallets.b.key.accAddress } },
    testState.lcdClient.config.URL
  ).then((r) => Number(r.withdrawable));

  if (withdrawableUnbonded != unbondAmount) {
    throw new Error(
      `expected withdrawableUnbonded != actual withdrawableUnbonded: ${unbondAmount} != ${withdrawableUnbonded}`
    );
  }

  // some rogue transfer
  let rogueLunaAmount = 5000000;
  await mustPass(
    send_transaction(testState.wallets.ownerWallet, [
      new MsgSend(
        testState.wallets.ownerWallet.key.accAddress,
        testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
        `${rogueLunaAmount}uluna`
      ),
    ])
  );

  await mustPass(
    testState.lasset.send_cw20_token(
      testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress,
      testState.wallets.b,
      unbondAmount,
      { unbond: {} },
      testState.lasset.contractInfo.lido_cosmos_hub.contractAddress
    )
  );

  await wait(5000);

  withdrawableUnbonded = await makeRestStoreQuery(
    testState.lasset.contractInfo.lido_cosmos_hub.contractAddress,
    { withdrawable_unbonded: { address: testState.wallets.b.key.accAddress } },
    testState.lcdClient.config.URL
  ).then((r) => r.withdrawable);
  if (withdrawableUnbonded != unbondAmount * 2) {
    throw new Error(
      `expected withdrawableUnbonded != actual withdrawableUnbonded: ${
        unbondAmount * 2
      } != ${withdrawableUnbonded}`
    );
  }

  let lunaBalanceBeforeWithdraw = await getLunaBalance(
    testState,
    testState.wallets.b.key.accAddress
  );
  await mustPass(testState.lasset.finish(testState.wallets.b));
  let lunaBalanceAfterWithdraw = await getLunaBalance(
    testState,
    testState.wallets.b.key.accAddress
  );

  console.log(
    `lunaBalanceBeforeWithdraw = ${lunaBalanceBeforeWithdraw}\nlunaBalanceAfterWithdraw = ${lunaBalanceAfterWithdraw}`
  );

  if (
    !approxeq(
      +lunaBalanceAfterWithdraw - +lunaBalanceBeforeWithdraw,
      +withdrawableUnbonded + +rogueLunaAmount,
      2
    )
  ) {
    throw new Error(`withdraw amount is not equal to withdrawableUnboned: 
                                    ${
                                      +lunaBalanceAfterWithdraw -
                                      +lunaBalanceBeforeWithdraw
                                    } != ${
      +withdrawableUnbonded + +rogueLunaAmount
    }`);
  }
}

main()
  .then(() => console.log("done"))
  .catch(console.log);
