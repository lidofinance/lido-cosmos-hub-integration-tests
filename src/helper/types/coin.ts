// since on cosmos hub there are no cosmwasm support, yet, we're using Terra infrastructure to run
// integration tests for atom-related contracts. Thus, we can't use atom, so here it's shadowed with
// luna. Once cosmwasm becomes available on cosmos hub and is used in the integration tests, change
// the value to respective atom one.
export const atomDenom = "uluna";