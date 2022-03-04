# How to run this code?

#### 1. Clone repository and install or update dependencies with command

```shell
yarn install
```
#### 2. Put Lido artifacts in the `./lido-cosmos-contracts/artifacts` directory

#### 3. Run the 4-validators LocalTerra set up

To start the 4-set validators environment - run `make start` in the `testkit` dir:

```
cd testnet
make stop && make start
```

Keep in mind that `http://192.168.10.2:1317/oracle/denoms/exchange_rates` starts working after 30-45 blocks (and the same amount of seconds). `update_global_index` needs the endpoint to work; in most of the testcases this does not matter, but if you want to call `update_global_index` soon after test starts, give some time to env get ready. To check oracles endpoint you can run:

```shell
curl http://192.168.10.2:1317/oracle/denoms/exchange_rates
{"height":"927","result":[
  {
    "denom": "ukrw",
    "amount": "37448.842927253220580494"
  },
  {
    "denom": "umnt",
    "amount": "92371.292031605468186648"
  },
  {
    "denom": "usdr",
    "amount": "22.762391055342055070"
  },
  {
    "denom": "uusd",
    "amount": "32.400734854805658804"
  }
]}
```

**Note: on Mac you might have to change `192.168.10.2:1317` to `0.0.0.0:1317`.**

#### 5. Run the tests

```
npx ts-node ./src/testcases/statom_short.test.ts
npx ts-node ./src/testcases/statom_long.test.ts
npx ts-node ./src/testcases/pausable_contracts.test.ts
npx ts-node ./src/testcases/redistribution.test.ts
npx ts-node ./src/testcases/slashing.test.ts
npx ts-node ./src/testcases/unbond_rogue_transfer.test.ts
```

**Note: it is recommended to clear env with `make stop && make start` before each run to reset the state.**

