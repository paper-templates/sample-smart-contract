import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import ChaiAsPromised from "chai-as-promised";
import { BigNumber, utils } from "ethers";
import { ethers } from "hardhat";
import CollectionConfig from "../config/CollectionConfig";
import ContractArguments from "../config/ContractArguments";
import { NftContractType } from "../lib/NftContractProvider";

chai.use(ChaiAsPromised);

enum SaleType {
  WHITELIST = CollectionConfig.whitelistSale.price,
  PRE_SALE = CollectionConfig.preSale.price,
  PUBLIC_SALE = CollectionConfig.publicSale.price,
}

function getPrice(saleType: SaleType, mintAmount: number) {
  return utils.parseEther(saleType.toString()).mul(mintAmount);
}

describe("Paper mint function", function () {
  let owner!: SignerWithAddress;
  let paperKeySigner!: SignerWithAddress;
  let externalUser!: SignerWithAddress;
  let contract!: NftContractType;
  let domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  const types = {
    PrimaryData: [
      {
        name: "recipient",
        type: "address",
      },
      { name: "quantity", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };
  const nonce = function (length: number) {
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let text = "";
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };
  const message = {
    recipient: "0x450D82Ed59f9238FB7fa37E006B32b2c51c37596",

    quantity: 1,
    nonce: ethers.utils.formatBytes32String(nonce(31)),
  };

  before(async function () {
    const Contract = await ethers.getContractFactory(
      CollectionConfig.contractName
    );
    Contract.connect(owner);
    contract = (await Contract.deploy(...ContractArguments)) as NftContractType;
    await contract.deployed();

    [owner, externalUser, paperKeySigner] = await ethers.getSigners();
    domain = {
      name: "Paper",
      version: "1",
      chainId: await paperKeySigner.getChainId(),
      verifyingContract: contract.address,
    };
  });

  it("Paper generated signature can mint", async function () {
    const signature = await paperKeySigner._signTypedData(
      domain,
      types,
      message
    );

    await contract.paperMint(
      message.recipient,
      message.quantity,
      message.nonce,
      signature
    );

    expect(
      await contract.walletOfOwner("0x450D82Ed59f9238FB7fa37E006B32b2c51c37596")
    ).deep.equal([BigNumber.from(0)]);
  });
  it("Minting with the same signature again should fail", async function () {
    const signature = await paperKeySigner._signTypedData(
      domain,
      types,
      message
    );
    await expect(
      contract.paperMint(
        message.recipient,
        message.quantity,
        message.nonce,
        signature
      )
    ).to.be.revertedWith("'Mint request already processed");
  });

  it("Non paper wallets cannot generate signature to mint", async function () {
    const signature = await externalUser._signTypedData(domain, types, message);
    await expect(
      contract.paperMint(
        message.recipient,
        message.quantity,
        message.nonce,
        signature
      )
    ).to.be.revertedWith("Invalid signature");
  });
});

describe(CollectionConfig.contractName, function () {
  let owner!: SignerWithAddress;
  let whitelistedUser!: SignerWithAddress;
  let holder!: SignerWithAddress;
  let externalUser!: SignerWithAddress;
  let contract!: NftContractType;

  before(async function () {
    [owner, whitelistedUser, holder, externalUser] = await ethers.getSigners();
  });

  it("Contract deployment", async function () {
    const Contract = await ethers.getContractFactory(
      CollectionConfig.contractName
    );
    contract = (await Contract.deploy(...ContractArguments)) as NftContractType;

    await contract.deployed();
  });

  it("Check initial data", async function () {
    expect(await contract.name()).to.equal(CollectionConfig.tokenName);
    expect(await contract.symbol()).to.equal(CollectionConfig.tokenSymbol);
    expect(await contract.cost()).to.equal(getPrice(SaleType.WHITELIST, 1));
    expect(await contract.maxSupply()).to.equal(CollectionConfig.maxSupply);
    expect(await contract.maxMintAmountPerTx()).to.equal(
      CollectionConfig.whitelistSale.maxMintAmountPerTx
    );
    expect(await contract.hiddenMetadataUri()).to.equal(
      CollectionConfig.hiddenMetadataUri
    );

    expect(await contract.paused()).to.equal(true);
    expect(await contract.revealed()).to.equal(false);

    await expect(contract.tokenURI(1)).to.be.revertedWith(
      "ERC721Metadata: URI query for nonexistent token"
    );
  });

  it("Before any sale", async function () {
    // Nobody should be able to mint from a paused contract
    await expect(
      contract
        .connect(whitelistedUser)
        .mint(1, { value: getPrice(SaleType.WHITELIST, 1) })
    ).to.be.revertedWith("The contract is paused!");
    expect(
      contract
        .connect(holder)
        .mint(1, { value: getPrice(SaleType.WHITELIST, 1) })
    ).to.be.revertedWith("The contract is paused!");

    await expect(
      contract
        .connect(owner)
        .mint(1, { value: getPrice(SaleType.WHITELIST, 1) })
    ).to.be.revertedWith("The contract is paused!");

    // The owner should always be able to run mintForAddress
    await (await contract.mintForAddress(1, await owner.getAddress())).wait();
    await (
      await contract.mintForAddress(1, await whitelistedUser.getAddress())
    ).wait();
    // But not over the maxMintAmountPerTx
    await expect(
      contract.mintForAddress(
        await (await contract.maxMintAmountPerTx()).add(1),
        await holder.getAddress()
      )
    ).to.be.revertedWith("Invalid mint amount!");

    // Check balances
    expect(await contract.balanceOf(await owner.getAddress())).to.equal(1);
    expect(
      await contract.balanceOf(await whitelistedUser.getAddress())
    ).to.equal(1);
    expect(await contract.balanceOf(await holder.getAddress())).to.equal(0);
    expect(await contract.balanceOf(await externalUser.getAddress())).to.equal(
      0
    );
  });

  it("Pre-sale (same as public sale)", async function () {
    await contract.setMaxMintAmountPerTx(
      CollectionConfig.preSale.maxMintAmountPerTx
    );
    await contract.setPaused(false);
    await contract.setCost(getPrice(SaleType.PRE_SALE, 1));
    await contract
      .connect(holder)
      .mint(2, { value: getPrice(SaleType.PRE_SALE, 2) });
    await contract
      .connect(whitelistedUser)
      .mint(1, { value: getPrice(SaleType.PRE_SALE, 1) });
    // Sending insufficient funds
    await expect(
      contract
        .connect(holder)
        .mint(1, { value: getPrice(SaleType.PRE_SALE, 1).sub(1) })
    ).to.be.rejectedWith(
      Error,
      "insufficient funds for intrinsic transaction cost"
    );
    // Sending an invalid mint amount
    await expect(
      contract
        .connect(whitelistedUser)
        .mint(await (await contract.maxMintAmountPerTx()).add(1), {
          value: getPrice(
            SaleType.PRE_SALE,
            await (await contract.maxMintAmountPerTx()).add(1).toNumber()
          ),
        })
    ).to.be.revertedWith("Invalid mint amount!");

    // Pause pre-sale
    await contract.setPaused(true);
    await contract.setCost(
      utils.parseEther(CollectionConfig.publicSale.price.toString())
    );
  });

  it("Owner only functions", async function () {
    await expect(
      contract
        .connect(externalUser)
        .mintForAddress(1, await externalUser.getAddress())
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      contract.connect(externalUser).setRevealed(false)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      contract.connect(externalUser).setCost(utils.parseEther("0.0000001"))
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      contract.connect(externalUser).setMaxMintAmountPerTx(99999)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      contract.connect(externalUser).setHiddenMetadataUri("INVALID_URI")
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      contract.connect(externalUser).setUriPrefix("INVALID_PREFIX")
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      contract.connect(externalUser).setUriSuffix("INVALID_SUFFIX")
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      contract.connect(externalUser).setPaused(false)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(contract.connect(externalUser).withdraw()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Wallet of owner", async function () {
    expect(await contract.walletOfOwner(await owner.getAddress())).deep.equal([
      BigNumber.from(0),
    ]);
    expect(
      await contract.walletOfOwner(await whitelistedUser.getAddress())
    ).deep.equal([BigNumber.from(1), BigNumber.from(4)]);
    expect(await contract.walletOfOwner(await holder.getAddress())).deep.equal([
      BigNumber.from(2),
      BigNumber.from(3),
    ]);
    expect(
      await contract.walletOfOwner(await externalUser.getAddress())
    ).deep.equal([]);
  });

  it("Supply checks (long)", async function () {
    if (process.env.EXTENDED_TESTS === undefined) {
      this.skip();
    }

    const alreadyMinted = 6;
    const maxMintAmountPerTx = 1000;
    const iterations = Math.floor(
      (CollectionConfig.maxSupply - alreadyMinted) / maxMintAmountPerTx
    );
    const expectedTotalSupply = iterations * maxMintAmountPerTx + alreadyMinted;
    const lastMintAmount = CollectionConfig.maxSupply - expectedTotalSupply;
    expect(await contract.totalSupply()).to.equal(alreadyMinted);

    await contract.setPaused(false);
    await contract.setMaxMintAmountPerTx(maxMintAmountPerTx);

    await Promise.all(
      Array(iterations).map(
        async () =>
          await contract.connect(whitelistedUser).mint(maxMintAmountPerTx, {
            value: getPrice(SaleType.PUBLIC_SALE, maxMintAmountPerTx),
          })
      )
    );

    // Try to mint over max supply (before sold-out)
    await expect(
      contract.connect(holder).mint(lastMintAmount + 1, {
        value: getPrice(SaleType.PUBLIC_SALE, lastMintAmount + 1),
      })
    ).to.be.revertedWith("Max supply exceeded!");
    await expect(
      contract.connect(holder).mint(lastMintAmount + 2, {
        value: getPrice(SaleType.PUBLIC_SALE, lastMintAmount + 2),
      })
    ).to.be.revertedWith("Max supply exceeded!");

    expect(await contract.totalSupply()).to.equal(expectedTotalSupply);

    // Mint last tokens with owner address and test walletOfOwner(...)
    await contract.connect(owner).mint(lastMintAmount, {
      value: getPrice(SaleType.PUBLIC_SALE, lastMintAmount),
    });
    const expectedWalletOfOwner = [BigNumber.from(1)];
    for (const i of Array(lastMintAmount).reverse()) {
      expectedWalletOfOwner.push(
        BigNumber.from(CollectionConfig.maxSupply - i)
      );
    }
    expect(
      await contract.walletOfOwner(await owner.getAddress(), {
        // Set gas limit to the maximum value since this function should be used off-chain only and it would fail otherwise...
        gasLimit: BigNumber.from("0xffffffffffffffff"),
      })
    ).deep.equal(expectedWalletOfOwner);

    // Try to mint over max supply (after sold-out)
    await expect(
      contract
        .connect(whitelistedUser)
        .mint(1, { value: getPrice(SaleType.PUBLIC_SALE, 1) })
    ).to.be.revertedWith("Max supply exceeded!");

    expect(await contract.totalSupply()).to.equal(CollectionConfig.maxSupply);
  });

  it("Token URI generation", async function () {
    const uriPrefix = "ipfs://__COLLECTION_CID__/";
    const uriSuffix = ".json";
    const totalSupply = await contract.totalSupply();

    expect(await contract.tokenURI(0)).to.equal(
      CollectionConfig.hiddenMetadataUri
    );

    // Reveal collection
    await contract.setUriPrefix(uriPrefix);
    await contract.setRevealed(true);
    // ERC721A uses token IDs starting from 0 internally...
    await expect(contract.tokenURI(11)).to.be.revertedWith(
      "ERC721Metadata: URI query for nonexistent token"
    );

    // Testing first and last minted tokens
    expect(await contract.tokenURI(1)).to.equal(`${uriPrefix}1${uriSuffix}`);
    expect(await contract.tokenURI(totalSupply.sub(1))).to.equal(
      `${uriPrefix}${totalSupply.sub(1)}${uriSuffix}`
    );
  });
});
