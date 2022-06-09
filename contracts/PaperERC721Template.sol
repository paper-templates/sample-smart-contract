// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9 <0.9.0;

import "@paperxyz/contracts/verification/PaperVerification.sol";
import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @notice Credits to HashLips which provided the base from which this contract was derived from
contract PaperERC721Template is
    ERC721A,
    Ownable,
    ReentrancyGuard,
    PaperVerification
{
    using Strings for uint256;

    string public uriPrefix = "";
    string public uriSuffix = ".json";
    string public hiddenMetadataUri;

    uint256 public cost;
    uint256 public maxSupply;
    uint256 public maxMintAmountPerTx;

    bool public paused = true;
    bool public revealed = false;

    constructor(
        address _paperKey,
        string memory _tokenName,
        string memory _tokenSymbol,
        uint256 _cost,
        uint256 _maxSupply,
        uint256 _maxMintAmountPerTx,
        string memory _hiddenMetadataUri
    ) ERC721A(_tokenName, _tokenSymbol) PaperVerification(_paperKey) {
        setCost(_cost);
        maxSupply = _maxSupply;
        setMaxMintAmountPerTx(_maxMintAmountPerTx);
        setHiddenMetadataUri(_hiddenMetadataUri);
    }

    modifier mintCompliance(uint256 _mintAmount) {
        require(
            _mintAmount > 0 && _mintAmount <= maxMintAmountPerTx,
            "Invalid mint amount!"
        );
        require(
            totalSupply() + _mintAmount <= maxSupply,
            "Max supply exceeded!"
        );
        _;
    }

    modifier mintPriceCompliance(uint256 _mintAmount) {
        require(msg.value >= cost * _mintAmount, "Insufficient funds!");
        _;
    }

    /// @dev Used after a user completes a fiat or cross chain crypto payment by paper's backend to mint a new token for user.
    /// Should _not_ have price check if you intend to off ramp in Fiat or if you want dynamic pricing.
    /// Enables custom metadata to be passed to the contract for whitelist, custom params, etc. via bytes data
    /// @param _mintData Contains information on the tokenId, quantity, recipient and more.
    function paperMint(
        PaperMintData.MintData calldata _mintData,
        bytes memory data
    ) external payable onlyPaper(_mintData) mintCompliance(_mintData.quantity) {
        // todo: your mint method here.
        require(!paused, "The contract is paused!");
        _safeMint(_mintData.recipient, _mintData.quantity, data);
    }

    /// @dev used for native minting on Paper platform.
    /// @param _recipient address of the recipient
    /// @param _quantity quantity of the token to mint
    function claimTo(address _recipient, uint256 _quantity)
        external
        payable
        mintCompliance(_quantity)
        mintPriceCompliance(_quantity)
    {
        // todo: your mint method here.
        require(!paused, "The contract is paused!");
        _safeMint(_recipient, _quantity);
    }

    function getClaimIneligibilityReason(address _recipient, uint256 _quantity)
        external
        view
        returns (string memory)
    {
        // todo: add your error reasons here.
        if (paused) {
            return "Not live yet";
        } else if (_quantity > maxMintAmountPerTx) {
            return "max mint amount per transaction exceeded";
        } else if (totalSupply() + _quantity > maxSupply) {
            return "not enough supply";
        }
        return "";
    }

    function unclaimedSupply() external view returns (uint256) {
        return maxSupply - totalSupply();
    }

    function setPaperKey(address _paperKey) external onlyOwner {
        _setPaperKey(_paperKey);
    }

    function mintForAddress(uint256 _mintAmount, address _receiver)
        public
        mintCompliance(_mintAmount)
        onlyOwner
    {
        _safeMint(_receiver, _mintAmount);
    }

    function walletOfOwner(address _owner)
        public
        view
        returns (uint256[] memory)
    {
        uint256 ownerTokenCount = balanceOf(_owner);
        uint256[] memory ownedTokenIds = new uint256[](ownerTokenCount);
        uint256 currentTokenId = _startTokenId();
        uint256 ownedTokenIndex = 0;
        address latestOwnerAddress;

        while (
            ownedTokenIndex < ownerTokenCount && currentTokenId < _currentIndex
        ) {
            TokenOwnership memory ownership = _ownerships[currentTokenId];

            if (!ownership.burned) {
                if (ownership.addr != address(0)) {
                    latestOwnerAddress = ownership.addr;
                }

                if (latestOwnerAddress == _owner) {
                    ownedTokenIds[ownedTokenIndex] = currentTokenId;

                    ownedTokenIndex++;
                }
            }

            currentTokenId++;
        }

        return ownedTokenIds;
    }

    function tokenURI(uint256 _tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(
            _exists(_tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        if (revealed == false) {
            return hiddenMetadataUri;
        }

        string memory currentBaseURI = _baseURI();
        return
            bytes(currentBaseURI).length > 0
                ? string(
                    abi.encodePacked(
                        currentBaseURI,
                        _tokenId.toString(),
                        uriSuffix
                    )
                )
                : "";
    }

    function setRevealed(bool _state) public onlyOwner {
        revealed = _state;
    }

    function setCost(uint256 _cost) public onlyOwner {
        cost = _cost;
    }

    function setMaxMintAmountPerTx(uint256 _maxMintAmountPerTx)
        public
        onlyOwner
    {
        maxMintAmountPerTx = _maxMintAmountPerTx;
    }

    function setHiddenMetadataUri(string memory _hiddenMetadataUri)
        public
        onlyOwner
    {
        hiddenMetadataUri = _hiddenMetadataUri;
    }

    function setUriPrefix(string memory _uriPrefix) public onlyOwner {
        uriPrefix = _uriPrefix;
    }

    function setUriSuffix(string memory _uriSuffix) public onlyOwner {
        uriSuffix = _uriSuffix;
    }

    function setPaused(bool _state) public onlyOwner {
        paused = _state;
    }

    function withdraw() public onlyOwner nonReentrant {
        (bool os, ) = payable(owner()).call{value: address(this).balance}("");
        require(os, "Withdrawal failed!");
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return uriPrefix;
    }
}
