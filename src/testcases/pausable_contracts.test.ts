import { mustPass, mustFail, mustFailWithErrorMsg } from "../helper/flow/must";
import { TestStateLocalTestNet } from "./common_localtestnet";
import { wait } from "../helper/flow/sleep";

async function main() {
  const testState = new TestStateLocalTestNet();

  await testState.init();

  let stAtomBondAmount = 20_000_000_000;

  await mustPass(
    testState.lasset.bond_for_statom(testState.wallets.c, stAtomBondAmount)
  );

  await wait(2500);

  await mustPass(
    testState.lasset.dispatch_rewards(testState.wallets.ownerWallet)
  );

  // only the owner can manage guardians
  await mustFailWithErrorMsg(
    testState.lasset.add_guardians(testState.wallets.d, [
      testState.wallets.a.key.accAddress,
      testState.wallets.b.key.accAddress,
    ]),
    "unauthorized"
  );

  await mustPass(
    testState.lasset.add_guardians(testState.wallets.ownerWallet, [
      testState.wallets.a.key.accAddress,
      testState.wallets.b.key.accAddress,
    ])
  );

  // guardian B pauses the contracts
  await mustPass(testState.lasset.pauseContracts(testState.wallets.b));

  await mustFailWithErrorMsg(
    testState.lasset.dispatch_rewards(testState.wallets.ownerWallet),
    "contract is temporarily paused"
  ); // hub must be paused

  await mustFailWithErrorMsg(
    testState.lasset.bond_for_statom(testState.wallets.d, stAtomBondAmount),
    "contract is temporarily paused"
  ); // hub must be paused
  await mustFailWithErrorMsg(
    testState.lasset.finish(testState.wallets.d),
    "contract is temporarily paused"
  ); // hub must be paused
  await mustFailWithErrorMsg(
    testState.lasset.transfer_cw20_token(
      testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress,
      testState.wallets.d,
      testState.wallets.c,
      1_000_000_000
    ),
    "contract is temporarily paused"
  );

  await mustFailWithErrorMsg(
    testState.lasset.transfer_cw20_token(
      testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress,
      testState.wallets.c,
      testState.wallets.d,
      1_000_000_000
    ),
    "contract is temporarily paused"
  );

  // only the owner can unpause contracts
  await mustFailWithErrorMsg(
    testState.lasset.unpauseContracts(testState.wallets.b),
    "unauthorized"
  );

  // unpause contracts
  await mustPass(
    testState.lasset.unpauseContracts(testState.wallets.ownerWallet)
  );

  // check that all contracts are unpaused
  await mustPass(
    testState.lasset.dispatch_rewards(testState.wallets.ownerWallet)
  );
  await mustPass(
    testState.lasset.bond_for_statom(testState.wallets.d, stAtomBondAmount)
  );

  await mustPass(
    testState.lasset.transfer_cw20_token(
      testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress,
      testState.wallets.d,
      testState.wallets.c,
      1_000_000_000
    )
  );

  await mustPass(
    testState.lasset.transfer_cw20_token(
      testState.lasset.contractInfo.lido_cosmos_token_statom.contractAddress,
      testState.wallets.c,
      testState.wallets.d,
      1_000_000_000
    )
  );

  // only the owner can manage guardians
  await mustFailWithErrorMsg(
    testState.lasset.remove_guardians(testState.wallets.b, [
      testState.wallets.a.key.accAddress,
    ]),
    "unauthorized"
  );

  await mustPass(
    testState.lasset.remove_guardians(testState.wallets.ownerWallet, [
      testState.wallets.b.key.accAddress,
    ])
  );

  // guardian B cannot pause the contracts because it was removed
  await mustFail(testState.lasset.pauseContracts(testState.wallets.b));

  // but guardian A can pause the contracts
  await mustPass(testState.lasset.pauseContracts(testState.wallets.a));
}

main()
  .then(() => console.log("done"))
  .catch(console.log);
