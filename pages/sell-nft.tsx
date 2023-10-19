import type { NextPage } from "next"
import { Form, Button, useNotification } from "web3uikit"
import { useWeb3Contract, useMoralis } from "react-moralis"
import nftMarketplaceAbi from "../constants/Marketplace.json"
import nftAbi from "../constants/AANFT.json"
import networkMapping from "../constants/networkMapping.json"
import { useEffect, useState } from "react"
import { BigNumber, ethers } from "ethers"

type NetworkConfigItem = {
  Marketplace: string[]
  NFT: string[]
}

type NetworkConfigMap = {
  [chainId: string]: NetworkConfigItem
}

const SellNft: NextPage = () => {
  const { chainId, account, isWeb3Enabled } = useMoralis()
  const chainString = chainId ? parseInt(chainId).toString() : "80001"
  // Should point to correct address
  // const marketplaceAddress = (networkMapping as NetworkConfigMap)[chainString].NftMarketplace[0]
  // const marketplaceAddress = "0xCCDF1f9bAeb64d31391E503D27C014d0707a4eA6"
  const marketplaceAddress = (networkMapping as NetworkConfigMap)[chainString]
    .Marketplace[0]
  const [proceeds, setProceeds] = useState("0")
  const [royalties, setRoyalties] = useState("0")

  const dispatch = useNotification()

  // @ts-ignore
  const { runContractFunction } = useWeb3Contract()

  const royaltyOptions = {
    abi: nftMarketplaceAbi,
    contractAddress: marketplaceAddress,
    functionName: "withdrawRoyalties",
    params: {},
  }
  const withDrawOptions = {
    abi: nftMarketplaceAbi,
    contractAddress: marketplaceAddress,
    functionName: "withdrawProceeds",
    params: {},
  }

  async function setupUI() {
    const returnedRoyalties: any = await runContractFunction({
      params: {
        abi: nftMarketplaceAbi,
        contractAddress: marketplaceAddress,
        functionName: "getRoyalties",
        params: {
          royaltiesReceiver: account,
        },
      },
      onSuccess: () => console.log("Setup Successfull! 1"),

      onError: (error) => console.log(error),
    })
    const returnedProceeds: any = await runContractFunction({
      params: {
        abi: nftMarketplaceAbi,
        contractAddress: marketplaceAddress,
        functionName: "getProceeds",
        params: {
          seller: account,
        },
      },
      onSuccess: () => console.log("Setup Successfull! 2"),

      onError: (error) => console.log(error),
    })
    if (returnedProceeds) {
      setProceeds(returnedProceeds.toString())
    }
    if (returnedRoyalties) {
      setRoyalties(returnedRoyalties.toString())
    }
  }

  useEffect(() => {
    setupUI()
  }, [royalties, proceeds, account, isWeb3Enabled, chainId])

  const handleWithdrawSuccess = () => {
    dispatch({
      type: "success",
      message: "Proceeds withdrawn successfully",
      title: "Proceeds Withdrawn",
      position: "topR",
    })
  }

  const handleRoyaltyClaimSuccess = () => {
    dispatch({
      type: "success",
      message: "Royalty claimed successfully",
      title: "Royalty claimed",
      position: "topR",
    })
  }
  async function handleApproveSuccess(
    nftAddress: string,
    tokenId: string,
    price: string
  ) {
    console.log("Ok... Now listing the item...")

    const options = {
      abi: nftMarketplaceAbi,
      contractAddress: marketplaceAddress,
      functionName: "listItem",
      params: {
        nftAddress: nftAddress,
        tokenId: tokenId,
        price: price,
      },
    }

    await runContractFunction({
      params: options,
      onSuccess: async (tx: any) => {
        await tx.wait(1)
        handleListSuccess()
      },
      onError: (error) => console.log(error),
    })
  }

  async function handleListSuccess() {
    dispatch({
      type: "success",
      message: "NFT Listed successfully",
      title: "NFT Listed",
      position: "topR",
    })
  }

  async function approveAndList(data: any) {
    console.log("Approving...")
    const nftAddress = data.data[0].inputResult
    const tokenId = data.data[1].inputResult
    const price = ethers.utils
      .parseUnits(data.data[2].inputResult, "ether")
      .toString()

    const options = {
      abi: nftAbi,
      contractAddress: data.data[0].inputResult,
      functionName: "approve",
      params: {
        to: marketplaceAddress,
        tokenId: data.data[1].inputResult,
      },
    }

    await runContractFunction({
      params: options,
      onSuccess: async (tx: any) => {
        await tx.wait(1)
        handleApproveSuccess(nftAddress, tokenId, price)
      },
      onError: (error) => {
        console.log(error)
      },
    })
  }

  return (
    <div className="grid h-screen place-items-center">
      <div>
        <Form
          onSubmit={approveAndList}
          buttonConfig={{
            isLoading: false,
            type: "submit",
            theme: "primary",
            text: "Sell NFT!",
          }}
          data={[
            {
              inputWidth: "50%",
              name: "NFT Address",
              type: "text",
              value: "",
              key: "nftAddress",
            },
            {
              name: "NFT Token Id",
              type: "number",
              value: "",
              key: "tokenId",
            },
            {
              name: "Price (in ETH)",
              type: "number",
              value: "",
              key: "price",
            },
          ]}
          title="Sell your NFT!"
          id="Main Form"
        />
        <div className="py-4">
          <div className="flex flex-col gap-2 justify-items-start w-fit">
            <h2 className="text-2xl">
              Sales revenue{" "}
              {ethers.utils.formatUnits(proceeds.toString(), "ether")} Eth
            </h2>
            {proceeds != "0" ? (
              <Button
                id="withdraw-proceeds"
                onClick={() =>
                  runContractFunction({
                    params: withDrawOptions,
                    onSuccess: async (tx: any) => {
                      await tx.wait(1)
                      handleWithdrawSuccess
                    },
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
        <div className="py-4">
          <div className="flex flex-col gap-2 justify-items-start w-fit">
            <h2 className="text-2xl">
              Royalty Earned{" "}
              {ethers.utils.formatUnits(royalties.toString(), "ether")} Eth
            </h2>
            {royalties != "0" ? (
              <Button
                id="royalty-earned"
                onClick={() =>
                  runContractFunction({
                    params: royaltyOptions,
                    onSuccess: async (tx: any) => {
                      await tx.wait(1)
                      handleRoyaltyClaimSuccess
                    },
                    onError: (error) => console.log(error),
                  })
                }
                text="Claim Royalty"
                theme="primary"
                type="button"
              />
            ) : (
              <p>No royalty earned</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
export default SellNft
