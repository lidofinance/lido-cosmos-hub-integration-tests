/* tslint:disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * A fixed-point decimal value with 18 fractional digits, i.e. Decimal(1_000_000_000_000_000_000) == 1.0
 *
 * The greatest possible value that can be represented is 340282366920938463463.374607431768211455 (which is (2^128 - 1) / 10^18)
 */
export type Decimal = string;
export type Uint128 = string;

export interface StateResponse {
  last_index_modification: number;
  last_processed_batch: number;
  last_unbonded_time: number;
  prev_hub_balance: Uint128;
  statom_exchange_rate: Decimal;
  total_bond_statom_amount: Uint128;
  [k: string]: unknown;
}
