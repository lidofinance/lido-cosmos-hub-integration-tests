# How to run this code?

#### 1. Clone repository and install or update dependencies with command

```shell
yarn
```

#### 2. Put Lido artifacts in the `./lido-cosmos-contracts/artifacts` directory

#### 3. Run the 4-validators LocalTerra set up

To start the 4-set validators environment - run `make start` in the `src/testkit` dir:

```
cd testnet
make restart
```

#### 4. Run the tests

```
yarn test:short:statom
yarn test:long:statom
yarn test:short:pausable
yarn test:short:redistribution
yarn test:short:slashing
```

**Note: it is recommended to clear env with `make restart` before each run to reset the state.**
