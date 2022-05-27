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
  // Update this with the generated paper key given!
  paperKey: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  tokenName: "Paper ERC721 Template",
  tokenSymbol: "PET",
  hiddenMetadataUri: "ipfs://__CID__/hidden.json",
  maxSupply: 10000,
  whitelistSale: {
    price: 0.05,
    maxMintAmountPerTx: 1,
  },
  preSale: {
    price: 0.07,
    maxMintAmountPerTx: 2,
  },
  publicSale: {
    price: 0.09,
    maxMintAmountPerTx: 5,
  },
  contractAddress: null,
  marketplaceIdentifier: "my-nft-token",
  marketplaceConfig: Marketplaces.openSea,
  whitelistAddresses,
};

export default CollectionConfig;
