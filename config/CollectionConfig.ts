import CollectionConfigInterface from "../lib/CollectionConfigInterface";
import * as Marketplaces from "../lib/Marketplaces";
import * as Networks from "../lib/Networks";
import whitelistAddresses from "./whitelist.json";

const CollectionConfig: CollectionConfigInterface = {
  testnet: Networks.ethereumTestnet,
  mainnet: Networks.ethereumMainnet,
  // The contract name can be updated using the following command:
  // yarn rename-contract NEW_CONTRACT_NAME
  // Please DO NOT change it manually!
  contractName: "PaperERC721Template",
  tokenName: "Paper ERC721 Template",
  tokenSymbol: "PET",
  hiddenMetadataUri: "ipfs://QmZxqFxfHwqjGSYSKyVp7AR1qKQjy6Bq4YSo7GbnbnE6gc",
  maxSupply: 1000,
  whitelistSale: {
    price: 0.01,
    maxMintAmountPerTx: 1,
  },
  preSale: {
    price: 0.01,
    maxMintAmountPerTx: 2,
  },
  publicSale: {
    price: 0.01,
    maxMintAmountPerTx: 10,
  },
  contractAddress: "0x51BC2dE5181a1964Ad65669cf25Ba0E97b8a84BF",
  marketplaceIdentifier: "my-nft-token",
  marketplaceConfig: Marketplaces.openSea,
  whitelistAddresses,
};

export default CollectionConfig;
