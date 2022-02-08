import { GraphQLClient } from "graphql-request";
import { makeBalanceQuery, makeContractStoreQuery, makeQuery } from "./common";
import { Addresses, Contracts, Validators } from "./types";

export const getStAtomState = async (
    client: GraphQLClient,
    addresses: Addresses,
    validators: Validators,
    contracts: Contracts
) => {
    const total_statom_issued = await makeContractStoreQuery(
        contracts.stAtomToken,
        { token_info: {} },
        client
    );


    const statom_holders: {
        [address: string]: {
            balance: string;
        };
    } = {};

    for (const address of addresses) {
        const balance = await makeContractStoreQuery(
            contracts.stAtomToken,
            { balance: { address: address } },
            client
        ).then((r) => r.balance);

        statom_holders[address] = {
            balance,
        };
    }

    return {
        total_statom_issued,
        statom_holders,
    };
};
