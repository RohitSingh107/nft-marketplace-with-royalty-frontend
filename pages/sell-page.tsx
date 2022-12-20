import type { NextPage } from "next"
import { Form, Button, useNotification } from "web3uikit"
import { Upload } from "@web3uikit/core"
import { storeNFT } from "../utils/uploadToNFTstorage"
import { useWeb3Contract, useMoralis } from "react-moralis"
import marketplaceAbi from "../constants/Marketplace.json"
import aanftAbi from "../constants/AANFT.json"
import networkMapping from "../constants/networkMapping.json"
import { useEffect, useState } from "react"
import { BigNumber, ethers } from "ethers"

type NetworkConfigItem = {
  Marketplace: string[]
}

type NetworkConfigMap = {
  [chainId: string]: NetworkConfigItem
}

const SellNft: NextPage = () => {
  var fileUploaded = false
  var uploadedfile: Blob

  const { chainId, account, isWeb3Enabled } = useMoralis()

  const chainString = chainId ? parseInt(chainId).toString() : "80001"
  // Should point to correct address
  const marketplaceAddress = (networkMapping as NetworkConfigMap)[chainString]
    .Marketplace[0]
  const aanftAddress = "0xd47E8387177F2b07E52d86EFa8cdb52F84C1A62E"
  const [proceeds, setProceeds] = useState("0")

  const dispatch = useNotification()

  // @ts-ignore
  const { runContractFunction } = useWeb3Contract()

  const withDrawOptions = {
    abi: marketplaceAbi,
    contractAddress: marketplaceAddress,
    functionName: "withdrawProceeds",
    params: {},
  }
  // const { account } = useMoralis();

  async function setupUI() {
    const returnedProceeds = await runContractFunction({
      params: {
        abi: marketplaceAbi,
        contractAddress: marketplaceAddress,
        functionName: "getProceeds",
        params: {
          seller: account,
        },
      },
      onSuccess: () => console.log("Setup Successfull!"),

      onError: (error) => console.log(error),
    })
    if (returnedProceeds) {
      setProceeds(returnedProceeds.toString())
    }
  }

  useEffect(() => {
    setupUI()
  }, [proceeds, account, isWeb3Enabled, chainId])

  const handleWithdrawSuccess = () => {
    dispatch({
      type: "success",
      message: "Proceeds withdrawn successfully",
      title: "Proceeds Withdrawn",
      position: "topR",
    })
  }

  // async function approveAndList(
  //   nftAddress: string,
  //   tokenId: string,
  //   price: string
  // ) {
  //   console.log("Approving...")
  //   const options = {
  //     abi: aanftAbi,
  //     contractAddress: nftAddress,
  //     functionName: "approve",
  //     params: {
  //       to: marketplaceAddress,
  //       tokenId: tokenId,
  //     },
  //   }

  //   await runContractFunction({
  //     params: options,
  //     onSuccess: () => handleApproveSuccess(nftAddress, tokenId, price),
  //     onError: (error) => {
  //       console.log(error)
  //     },
  //   })
  // }

  function fileChange(file: Blob | null | undefined) {
    console.log("Uploading... Starts")
    fileUploaded = true
    uploadedfile = file!
  }
  async function mintAndList(data: any) {
    if (!fileUploaded || uploadedfile == undefined || uploadedfile == null) {
      dispatch({
        type: "error",
        message: "Please upload a valid image file",
        title: "Image not uploaded",
        position: "topR",
      })
      return
    }

    // const imgUrl = data.data[0].inputResult
    // const tokenId = data.data[0].inputResult
    const productName = data.data[1].inputResult
    const description = data.data[2].inputResult
    const price = ethers.utils.parseEther(data.data[3].inputResult.toString())

    const NFT_STORAGE_KEY = process.env.NFT_STORAGE_KEY

    console.log("Uploading.. to IPFS")
    // console.log(`NFT storage token is ${NFT_STORAGE_KEY}`)

    const ipfsToken = await storeNFT(
      uploadedfile,
      productName,
      description,
      NFT_STORAGE_KEY!
    )

    // console.log(ipfsToken)
    const { ipnft, url, data: metaData } = ipfsToken
    console.log(`ipfs Url : ${url}`)

    console.log("Minting...")

    await runContractFunction({
      params: {
        abi: aanftAbi,
        contractAddress: aanftAddress,

        functionName: "mintNFTWithRoyalty",
        params: {
          recipient: account,
          tokenURI: url,
          royaltyReceiver: account,
          feeNumerator: 100,
        },
      },
      onSuccess: () =>
        handleMintSuccess(
          aanftAddress,
          marketplaceAddress,
          price.toString(),
          aanftAbi
        ),
      onError: (error) => {
        console.log("NFT not minted")
        console.log(
          `nft addres is ${aanftAddress}, market: ${marketplaceAddress}, price : ${price.toString()}, abi is ${aanftAbi}`
        )
        console.log(error)
      },
    })
  }

  async function handleMintSuccess(
    nftAddress: string,
    marketplaceAddress: string,
    price: string,
    nftAbi: any
  ) {
    console.log("NFT minted Successfull!")
    console.log("Approving...")

    let r = await runContractFunction({
      params: {
        abi: nftAbi,
        contractAddress: nftAddress,
        functionName: "getCountOfSupply",
      },
      onSuccess: (n) =>
        handleGetCountSucess(
          nftAddress,
          marketplaceAddress,
          price,
          nftAbi,
          n!.toString()
        ),
      onError: (error) => {
        console.log("count not got")
        console.log(error)
      },
    })
  }

  async function handleGetCountSucess(
    nftAddress: string,
    marketplaceAddress: string,
    price: string,
    nftAbi: any,
    supplyCount: string
  ) {
    console.log(`supply count is {supplyCount}`)
    let tokenId = (+supplyCount + 1).toString()
    console.log(
      `nft address is ${nftAddress}, marketplaceAddress is ${marketplaceAddress}, tokenId is ${tokenId}`
    )
    console.log(nftAbi)

    await runContractFunction({
      params: {
        abi: nftAbi,
        contractAddress: nftAddress,
        functionName: "approve",
        params: {
          to: marketplaceAddress,
          tokenId: tokenId,
        },
      },
      onSuccess: () => handleApproveSuccess(nftAddress, tokenId, price),
      onError: (error) => {
        console.log("Approve not successful")
        console.log(
          `nft address is ${nftAddress}, marketplaceAddress is ${marketplaceAddress}, tokenId is ${tokenId}, abi is ${nftAbi}`
        )
        console.log(error)
      },
    })
  }

  async function handleApproveSuccess(
    nftAddress: string,
    tokenId: string,
    price: string
  ) {
    console.log("Approved!")
    console.log("Ok... Now listing the item...")

    await runContractFunction({
      params: {
        abi: marketplaceAbi,
        contractAddress: marketplaceAddress,
        functionName: "listItem",
        params: {
          nftAddress: nftAddress,
          tokenId: tokenId,
          price: price,
        },
      },
      onSuccess: () => handleListSuccess(),
      onError: (error) => {
        console.log("Item not Listed")
        console.log(
          `nft address is ${nftAddress}, marketplaceAddress is ${marketplaceAddress}, tokenId is ${tokenId}, price is ${price}, abi is ${marketplaceAbi}`
        )
        console.log(error)
      },
    })
  }

  async function handleListSuccess() {
    console.log("Successfully listed!")
    dispatch({
      type: "success",
      message: "NFT Listed successfully",
      title: "NFT Listed",
      position: "topR",
    })
  }
  return (
    <div className="grid h-screen place-items-center">
      <div>
        <div>
          <h1>Upload Your Product Image</h1>

          <Upload onChange={fileChange} theme="withIcon" />
        </div>

        <div>
          <Form
            onSubmit={mintAndList}
            buttonConfig={{
              isLoading: false,
              type: "submit",
              theme: "ghost",
              text: "List NFT!",
            }}
            data={[
              {
                name: "Product Serial Number",
                type: "number",
                validation: {
                  required: true,
                },
                value: "",
                key: "tokenId",
              },
              {
                name: "Name of the product",
                type: "text",
                validation: {
                  required: true,
                },
                value: "",
                key: "productName",
              },
              {
                name: "Description of your product",
                type: "textarea",
                value: "",
                key: "description",
              },
              {
                name: "Price (in MATIC)",
                type: "number",
                validation: {
                  required: true,
                },
                value: "",
                key: "price",
              },
            ]}
            title="Details of the product"
            id="Main Form"
          />
        </div>

        <div className="py-4">
          <div className="flex flex-col gap-2 justify-items-start w-fit">
            <h2 className="text-2xl">
              Withdraw {ethers.utils.formatUnits(proceeds.toString(), "ether")}{" "}
              proceeds
            </h2>
            {proceeds != "0" ? (
              <Button
                id="withdraw-proceeds"
                onClick={() =>
                  runContractFunction({
                    params: withDrawOptions,
                    onSuccess: () => handleWithdrawSuccess,
                    onError: (error) => console.log(error),
                  })
                }
                text="Withdraw"
                theme="primary"
                type="button"
              />
            ) : (
              <p>No withdrawable proceeds detected</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
export default SellNft
