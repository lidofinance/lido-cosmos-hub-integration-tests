import {AutomaticTxResponse, Testkit, TestkitInit} from "../testkit/testkit";
import {Coin, Coins, Dec, Int, LCDClient, MnemonicKey, MsgSend, Fee, Validator, Wallet} from "@terra-money/terra.js";
import Lido from "../helper/spawn";
import LidoAsset from "../helper/lido_helper";
import { atomDenom } from "../helper/types/coin";
import { registerChainOraclePrevote, registerChainOracleVote, defaultOraclePrice } from "../helper/oracle/chain-oracle";
import { setTestParams } from "../parameters/contract-tests-parameteres";
import { MantleState } from "../mantle-querier/MantleState";
import * as path from "path";

export class TestState {
    testkit: Testkit
    keys: Record<string, MnemonicKey>
    validatorKeys: Record<string, MnemonicKey>
    validators: TestkitInit.Validator[]
    gasStation: MnemonicKey
    lcdClient: LCDClient
    wallets: Record<string, Wallet>
    lido: Lido
    lasset: LidoAsset
    initialPrevotes: AutomaticTxResponse[]
    initialVotes: AutomaticTxResponse[]
    oraclePrice: string


    constructor(oraclePrice: string = defaultOraclePrice) {
        this.keys = {};
        this.validatorKeys = {};
        this.validators = [];
        this.wallets = {};
        this.oraclePrice = oraclePrice;
    }

    async getMantleState(testkit_host?:string): Promise<MantleState> {
        if (testkit_host==undefined) {
            testkit_host="http://localhost:11317"
        }
        this.testkit = new Testkit(testkit_host);
        const genesis = require("../testkit/genesis.json");

        this.keys.aKey = new MnemonicKey();
        this.keys.bKey = new MnemonicKey();
        this.keys.cKey = new MnemonicKey();
        this.keys.dKey = new MnemonicKey();
        this.keys.lidoKey = new MnemonicKey();
        this.keys.owner = new MnemonicKey();

        this.validatorKeys.validatorAKey = new MnemonicKey();
        this.validatorKeys.validatorBKey = new MnemonicKey();
        this.validatorKeys.validatorCKey = new MnemonicKey();
        this.validatorKeys.validatorDKey = new MnemonicKey();
        this.gasStation = new MnemonicKey();

        const response = await this.testkit.init({
            genesis: genesis,
            accounts: [
                Testkit.walletToAccountRequest("a", this.keys.aKey),
                Testkit.walletToAccountRequest("b", this.keys.bKey),
                Testkit.walletToAccountRequest("c", this.keys.cKey),
                Testkit.walletToAccountRequest("d", this.keys.dKey),
                Testkit.walletToAccountRequest("lido_fee", this.keys.lidoKey),
                Testkit.walletToAccountRequest("valA", this.validatorKeys.validatorAKey),
                Testkit.walletToAccountRequest("valB", this.validatorKeys.validatorBKey),
                Testkit.walletToAccountRequest("valC", this.validatorKeys.validatorCKey),
                Testkit.walletToAccountRequest("valD", this.validatorKeys.validatorDKey),
                Testkit.walletToAccountRequest("owner", this.keys.owner),
                Testkit.walletToAccountRequest("gasStation", this.gasStation),
            ],
            validators: [
                Testkit.validatorInitRequest(
                    "valA",
                    new Coin(atomDenom, new Int(1000000000000)),
                    new Validator.CommissionRates(new Dec(0), new Dec(1), new Dec(0))
                ),
                Testkit.validatorInitRequest(
                    "valB",
                    new Coin(atomDenom, new Int(1000000000000)),
                    new Validator.CommissionRates(new Dec(0), new Dec(1), new Dec(0))
                ),
                Testkit.validatorInitRequest(
                    "valC",
                    new Coin(atomDenom, new Int(1000000000000)),
                    new Validator.CommissionRates(new Dec(0), new Dec(1), new Dec(0))
                ),
                Testkit.validatorInitRequest(
                    "valD",
                    new Coin(atomDenom, new Int(1000000000000)),
                    new Validator.CommissionRates(new Dec(0), new Dec(1), new Dec(0))
                ),
            ],
            auto_inject: {
                validator_rounds: ["valB", "valC", "valD", "valA"],
            },
            auto_tx: [
                // fee generator
                Testkit.automaticTxRequest({
                    accountName: "gasStation",
                    period: 1,
                    startAt: 2,
                    msgs: [
                        new MsgSend(
                            this.gasStation.accAddress,
                            this.gasStation.accAddress,
                            new Coins([new Coin("uusd", 1)])
                        ),
                    ],
                    fee: new Fee(10000000, "1000000uusd"),
                }),
            ],
        });

        console.log(this.testkit.deriveMantle())

        this.validators = response.validators;
        this.lcdClient = this.testkit.deriveLCD();

        // initialize genesis block
        await this.testkit.inject();

        // register oracle votes
        const validatorNames = ["valA", "valB", "valC", "valD"];
        // register votes
        this.initialVotes = await Promise.all(
            this.validators.map(async (validator) =>
                this.testkit.registerAutomaticTx(
                    registerChainOracleVote(
                        validator.account_name,
                        validator.Msg.delegator_address,
                        validator.Msg.validator_address,
                        3,
                        this.oraclePrice
                    )
                )
            )
        );

        // register prevotes
        this.initialPrevotes = await Promise.all(
            this.validators.map(async (validator) =>
                this.testkit.registerAutomaticTx(
                    registerChainOraclePrevote(
                        validator.account_name,
                        validator.Msg.delegator_address,
                        validator.Msg.validator_address,
                        2,
                        this.oraclePrice
                    )
                )
            )
        );
        this.wallets.a = new Wallet(this.lcdClient, this.keys.aKey);
        this.wallets.b = new Wallet(this.lcdClient, this.keys.bKey);
        this.wallets.c = new Wallet(this.lcdClient, this.keys.cKey);
        this.wallets.d = new Wallet(this.lcdClient, this.keys.dKey);

        this.wallets.valAWallet = new Wallet(this.lcdClient, this.validatorKeys.validatorAKey);

        this.wallets.lido_fee = new Wallet(this.lcdClient, this.keys.lidoKey);

        // store & instantiate contracts
        this.wallets.ownerWallet = new Wallet(this.lcdClient, this.keys.owner);
        this.lido = new Lido(this.wallets.ownerWallet);
        await this.lido.store_contracts(
            path.resolve(__dirname, "../../lido-cosmos-contracts/artifacts"),
        );

        const fixedFeeForInit = new Fee(6000000, "2000000uusd");
        await this.lido.instantiate(
            fixedFeeForInit,
            setTestParams(
                this.validators[0].validator_address,
                this.wallets.a.key.accAddress,
                this.wallets.lido_fee.key.accAddress,
            ),
            this.validators
        );


        this.lasset = this.lido.lAsset;
        ////////////////////////

        // create mantle state
        console.log({
            lidoHub: this.lasset.contractInfo["lido_terra_hub"].contractAddress,
            stAtomToken: this.lasset.contractInfo["lido_terra_token_statom"].contractAddress,
            rewardsDispatcher: this.lasset.contractInfo["lido_terra_rewards_dispatcher"].contractAddress,
            validatorsRegistry: this.lasset.contractInfo["lido_terra_validators_registry"].contractAddress
        });

        const mantleState = new MantleState(
            {
                lidoHub: this.lasset.contractInfo["lido_terra_hub"].contractAddress,
                stAtomToken: this.lasset.contractInfo["lido_terra_token_statom"].contractAddress,
                rewardsDispatcher: this.lasset.contractInfo["lido_terra_rewards_dispatcher"].contractAddress,
                validatorsRegistry: this.lasset.contractInfo["lido_terra_validators_registry"].contractAddress
            },
            [this.keys.aKey.accAddress, this.keys.bKey.accAddress, this.keys.cKey.accAddress],
            response.validators.map((val) => val.validator_address),
            this.testkit.deriveMantle()
        );

        return mantleState
    }
}



