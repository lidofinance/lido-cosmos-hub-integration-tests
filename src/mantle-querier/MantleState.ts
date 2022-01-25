import { gql, GraphQLClient } from "graphql-request";
import { getCoreState } from "./core";
import { Addresses, Contracts, Validators } from "./types";
import {getStlunaState} from "./stLuna";

interface ContractAddresses {
    "lidoHub": string,
    "stLunaToken": string,
    "rewardsDispatcher": string,
    "validatorsRegistry": string,
}

export class MantleState {
    private contracts: Contracts
    private addresses: Addresses
    private validators: Validators
    private client: GraphQLClient

    constructor(
        contracts: ContractAddresses,
        addresses: string[],
        validators: string[],
        mantleEndpoint: string,
    ) {
        this.contracts = contracts
        this.addresses = addresses
        this.validators = validators
        this.client = new GraphQLClient(mantleEndpoint)
    }

    async getState() {
        return Promise.all([
            getCoreState(this.client, this.addresses, this.validators, this.contracts),
            getStlunaState(this.client, this.addresses, this.validators, this.contracts),
        ]).then(([core]) => ({
            ...core,
        }))
    }

    async getCurrentBlockHeight(): Promise<number> {
        return this.client.request(gql`
            query {
                BlockState {
                    Block {
                        Header {
                            Height
                        }
                    }
                }
            }
        `, {}).then(r => r.BlockState.Block.Header.Height)
    }

    async getCurrentBlockTime(): Promise<string> {
        return this.client.request(gql`
            query {
                BlockState {
                    Block {
                        Header {
                            Time
                        }
                    }
                }
            }
        `, {}).then(r => r.BlockState.Block.Header.Time)
    }

    async query(gql: string, variables: object) {
        return this.client.request(gql, variables)
    }
}