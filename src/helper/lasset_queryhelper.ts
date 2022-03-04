import { Validator as QueryValidator } from "./types/validators_registry/validator";
import { GraphQLClient } from "graphql-request";
import { Testkit } from "../testkit/testkit";
import LidoAsset from "./lido_helper";
import { AllowanceResponse } from "./types/cw20_token/allowance_response";
import { AllAccountsResponse } from "./types/cw20_token/all_accounts_response";
import { AllAllowancesResponse } from "./types/cw20_token/all_allowances_response";
import { TokenInfoResponse } from "./types/cw20_token/token_info_response";
import { MinterResponse } from "./types/cw20_token/token_init_msg";
import { QueryMsg as ValidatorsQueryMsg } from "./types/validators_registry/query_msg";
import { QueryMsg as LidoHubQueryMsg } from "./types/hub/query_msg";
import { State } from "./types/hub/state";
import { AllHistoryResponse } from "./types/hub/all_history_response";
import { UnbondRequestsResponse } from "./types/hub/unbond_requests_response";
import { WithdrawableUnbondedResponse } from "./types/hub/withdrawable_unbonded_response";
import { LCDClient } from "@terra-money/terra.js";
import axios from "axios";

export const makeRestStoreQuery = async (
  contract_address: string,
  msg: any,
  endpoint: string
): Promise<any> => {
  const r = await axios.get(
    `${endpoint}/wasm/contracts/${contract_address}/store`,
    { params: { query_msg: msg } }
  );
  return r.data["result"];
};

class TokenQuerier {
  token_address: string;
  lcd: LCDClient;

  constructor(token_address: string, lcd: LCDClient) {
    this.token_address = token_address;
    this.lcd = lcd;
    // lcd.wasm.contractQuery
  }

  async query(msg: object): Promise<any> {
    return makeRestStoreQuery(this.token_address, msg, this.lcd.config.URL);
  }

  // Returns the current balance of the given address, 0 if unset.
  public async balance(address: string): Promise<number> {
    return this.query({
      balance: {
        address: address,
      },
    }).then((b) => Number(b.balance));
  }
  // Returns metadata on the contract - name, decimals, supply, etc. Return type: TokenInfoResponse.
  public async token_info(): Promise<TokenInfoResponse> {
    return this.query({
      token_info: {},
    }).then((r) => r as TokenInfoResponse);
  }

  // Only with "mintable" extension. Returns who can mint and how much. Return type: MinterResponse.
  public async minter(): Promise<MinterResponse> {
    return this.query({
      minter: {},
    }).then((r) => r as MinterResponse);
  }

  // Only with "allowance" extension. Returns how much spender can use from owner account, 0 if unset. Return type: AllowanceResponse.
  public async allowance(
    owner_address: string,
    spender_address: string
  ): Promise<AllowanceResponse> {
    return this.query({
      allowance: {
        owner: owner_address,
        spender: spender_address,
      },
    }).then((r) => r as AllowanceResponse);
  }

  // Only with "enumerable" extension (and "allowances") Returns all allowances this owner has approved. Supports pagination. Return type: AllAllowancesResponse.
  public async all_allowances(
    owner_address: string,
    limit?: number,
    start_after_addr?: string
  ): Promise<AllAllowancesResponse> {
    return this.query({
      all_allowances: {
        owner: owner_address,
        limit: limit,
        start_after: start_after_addr,
      },
    }).then((r) => r as AllAllowancesResponse);
  }
  // Only with "enumerable" extension Returns all accounts that have balances. Supports pagination. Return type: AllAccountsResponse.
  public async all_accounts(
    limit?: number,
    start_after_addr?: string
  ): Promise<AllAccountsResponse> {
    return this.query({
      all_accounts: {
        limit: limit,
        start_after: start_after_addr,
      },
    }).then((r) => r as AllAccountsResponse);
  }
}

export default class LidoAssetQueryHelper {
  testkit: Testkit;
  mantleClient: GraphQLClient;
  lasset: LidoAsset;
  statom_token_querier: TokenQuerier;
  lcd: LCDClient;

  constructor(lcd: LCDClient, lasset: LidoAsset) {
    this.lcd = lcd;
    this.lasset = lasset;
    this.statom_token_querier = new TokenQuerier(
      this.lasset.contractInfo.lido_cosmos_token_statom.contractAddress,
      this.lcd
    );
  }

  async lassethubquery(msg: LidoHubQueryMsg): Promise<any> {
    return makeRestStoreQuery(
      this.lasset.contractInfo.lido_cosmos_hub.contractAddress,
      msg,
      this.lcd.config.URL
    );
  }

  async get_lido_cosmos_hub_state(): Promise<State> {
    return this.lassethubquery({
      state: {},
    }).then((r) => r as State);
  }

  async validatorsquery(msg: ValidatorsQueryMsg): Promise<any> {
    return makeRestStoreQuery(
      this.lasset.contractInfo.lido_cosmos_validators_registry.contractAddress,
      msg,
      this.lcd.config.URL
    );
  }

  /* BEGIN. statom helpers */

  // Returns the current statom balance of the given address, 0 if unset.
  public async balance_statom(address: string): Promise<number> {
    return this.statom_token_querier.balance(address);
  }

  // Returns metadata on the statom contract - name, decimals, supply, etc. Return type: TokenInfoResponse.
  public async token_info_statom(): Promise<TokenInfoResponse> {
    return this.statom_token_querier.token_info();
  }

  // Only with "mintable" extension. Returns who can mint statom and how much. Return type: MinterResponse.
  public async minter_statom(): Promise<MinterResponse> {
    return this.statom_token_querier.minter();
  }

  // Only with "allowance" extension. Returns how much spender can use from owner statom account, 0 if unset. Return type: AllowanceResponse.
  public async allowance_statom(
    owner_address: string,
    spender_address: string
  ): Promise<AllowanceResponse> {
    return this.statom_token_querier.allowance(owner_address, spender_address);
  }

  // Only with "enumerable" extension (and "allowances") Returns all allowances this owner has approved on the statom contract. Supports pagination. Return type: AllAllowancesResponse.
  public async all_allowances_statom(
    owner_address: string,
    limit?: number,
    start_after_addr?: string
  ): Promise<AllAllowancesResponse> {
    return this.statom_token_querier.all_allowances(
      owner_address,
      limit,
      start_after_addr
    );
  }

  // Only with "enumerable" extension Returns all accounts that have balances on the statom contract. Supports pagination. Return type: AllAccountsResponse.
  public async all_accounts_statom(
    limit?: number,
    start_after_addr?: string
  ): Promise<AllAccountsResponse> {
    return this.statom_token_querier.all_accounts(limit, start_after_addr);
  }

  /* END. statom helpers */

  public async get_validators_for_delegation(): Promise<Array<QueryValidator>> {
    return this.validatorsquery({
      get_validators_for_delegation: {},
    }).then((r) => r as Array<QueryValidator>);
  }

  public async statom_exchange_rate(): Promise<number> {
    return this.get_lido_cosmos_hub_state().then((r) =>
      Number(r.statom_exchange_rate)
    );
  }

  public async total_bond_statom_amount(): Promise<number> {
    return this.get_lido_cosmos_hub_state().then((r) =>
      Number(r.total_bond_statom_amount)
    );
  }

  public async all_history(
    limit?: number,
    start_from?: number
  ): Promise<AllHistoryResponse> {
    return this.lassethubquery({
      all_history: {
        limit: limit,
        start_from: start_from,
      },
    }).then((r) => r as AllHistoryResponse);
  }

  public async unbond_requests(
    address: string
  ): Promise<UnbondRequestsResponse> {
    return this.lassethubquery({
      unbond_requests: {
        address: address,
      },
    }).then((r) => r as UnbondRequestsResponse);
  }

  public async get_withdraweble_unbonded(
    address: string
  ): Promise<WithdrawableUnbondedResponse> {
    const latestBlock = await this.lcd.tendermint.blockInfo();
    return this.lassethubquery({
      withdrawable_unbonded: {
        address: address,
        block_time: Math.trunc(
          new Date(latestBlock.block.header.time).getTime() / 1000
        ),
      },
    }).then((r) => r as WithdrawableUnbondedResponse);
  }
}
